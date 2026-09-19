import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google, calendar_v3 } from "googleapis";

interface CalendarEventParams {
  summary: string;
  description: string;
  startTime: Date;
  durationMinutes: number;
  attendees: string[]; // Email addresses
  calendarId?: string; // Defaults to primary
}

interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
  meetLink?: string;
}

interface UpdateEventParams {
  eventId: string;
  calendarId?: string;
  summary?: string;
  description?: string;
  startTime?: Date;
  durationMinutes?: number;
  attendees?: string[];
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private calendar: calendar_v3.Calendar | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeClient();
  }

  /**
   * Initialize Google Calendar client using service account
   */
  private initializeClient(): void {
    try {
      // Support two ways of providing credentials:
      // 1. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY (separate values)
      // 2. GOOGLE_SERVICE_ACCOUNT_KEY (full JSON or base64-encoded JSON)
      
      const serviceAccountEmail = this.configService.get<string>("GOOGLE_SERVICE_ACCOUNT_EMAIL");
      const privateKey = this.configService.get<string>("GOOGLE_PRIVATE_KEY");
      const serviceAccountKey = this.configService.get<string>("GOOGLE_SERVICE_ACCOUNT_KEY");
      const calendarEmail = this.configService.get<string>("GOOGLE_CALENDAR_EMAIL");

      let clientEmail: string | undefined;
      let clientPrivateKey: string | undefined;

      // Option 1: Separate email and private key
      if (serviceAccountEmail && privateKey) {
        clientEmail = serviceAccountEmail;
        // Handle private key - it may have literal \n or actual newlines
        clientPrivateKey = privateKey.replace(/\\n/g, "\n");
        this.logger.log("Google Calendar: Using separate email and private key credentials");
      }
      // Option 2: Full JSON key (as JSON string or base64)
      else if (serviceAccountKey) {
        let credentials: any;
        try {
          // Try parsing as JSON directly
          credentials = JSON.parse(serviceAccountKey);
        } catch {
          // Try decoding from base64
          try {
            const decoded = Buffer.from(serviceAccountKey, "base64").toString("utf-8");
            credentials = JSON.parse(decoded);
          } catch {
            this.logger.error("Google Calendar: Failed to parse service account key");
            return;
          }
        }
        clientEmail = credentials.client_email;
        clientPrivateKey = credentials.private_key;
        this.logger.log("Google Calendar: Using full service account key JSON");
      }

      if (!clientEmail || !clientPrivateKey) {
        this.logger.warn(
          "Google Calendar: Credentials not configured. Set either GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, or GOOGLE_SERVICE_ACCOUNT_KEY"
        );
        return;
      }

      // Create JWT auth client
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: clientPrivateKey,
        scopes: [
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/calendar.events",
        ],
        // Impersonate the calendar owner for domain-wide delegation (optional)
        subject: calendarEmail || undefined,
      });

      if (calendarEmail) {
        this.logger.log(`Google Calendar: Using domain-wide delegation with subject: ${calendarEmail}`);
      } else {
        this.logger.warn("Google Calendar: GOOGLE_CALENDAR_EMAIL not set - domain-wide delegation disabled. Events with attendees may fail.");
      }

      this.calendar = google.calendar({ version: "v3", auth });
      this.isConfigured = true;
      this.logger.log(`Google Calendar: Service initialized successfully (service account: ${clientEmail})`);
    } catch (error) {
      this.logger.error("Google Calendar: Failed to initialize", error);
    }
  }

  /**
   * Check if the service is configured and ready
   */
  isReady(): boolean {
    return this.isConfigured && this.calendar !== null;
  }

  /**
   * Create a calendar event with Google Meet conference
   */
  async createEvent(params: CalendarEventParams): Promise<CalendarEventResult | null> {
    if (!this.calendar) {
      this.logger.warn("Google Calendar: Service not configured, skipping event creation");
      return null;
    }

    const { summary, description, startTime, durationMinutes, attendees, calendarId = "primary" } = params;

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    try {
      const event: calendar_v3.Schema$Event = {
        summary,
        description,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "UTC",
        },
        attendees: attendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `mentor-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 24 hours before
            { method: "email", minutes: 60 },       // 1 hour before
            { method: "popup", minutes: 15 },       // 15 minutes before
          ],
        },
        guestsCanModify: false,
        guestsCanInviteOthers: false,
      };

      this.logger.log(`Google Calendar: Creating event "${summary}" at ${startTime.toISOString()}`);

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: event,
        conferenceDataVersion: 1, // Required for Google Meet
        sendUpdates: "all", // Send invitations to attendees
      });

      const createdEvent = response.data;

      this.logger.log(`Google Calendar: Event created with ID ${createdEvent.id}`);

      return {
        eventId: createdEvent.id!,
        htmlLink: createdEvent.htmlLink!,
        meetLink: createdEvent.conferenceData?.entryPoints?.find(
          (ep: any) => ep.entryPointType === "video"
        )?.uri ?? undefined,
      };
    } catch (error: any) {
      this.logger.error(`Google Calendar: Failed to create event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(params: UpdateEventParams): Promise<CalendarEventResult | null> {
    if (!this.calendar) {
      this.logger.warn("Google Calendar: Service not configured, skipping event update");
      return null;
    }

    const { eventId, calendarId = "primary", summary, description, startTime, durationMinutes, attendees } = params;

    try {
      // First get the existing event
      const existingEvent = await this.calendar.events.get({
        calendarId,
        eventId,
      });

      const event = existingEvent.data;

      // Update fields if provided
      if (summary) event.summary = summary;
      if (description) event.description = description;
      if (startTime && durationMinutes) {
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        event.start = { dateTime: startTime.toISOString(), timeZone: "UTC" };
        event.end = { dateTime: endTime.toISOString(), timeZone: "UTC" };
      }
      if (attendees) {
        event.attendees = attendees.map((email) => ({ email }));
      }

      this.logger.log(`Google Calendar: Updating event ${eventId}`);

      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: event,
        sendUpdates: "all",
      });

      const updatedEvent = response.data;

      return {
        eventId: updatedEvent.id!,
        htmlLink: updatedEvent.htmlLink!,
        meetLink: updatedEvent.conferenceData?.entryPoints?.find(
          (ep: any) => ep.entryPointType === "video"
        )?.uri ?? undefined,
      };
    } catch (error: any) {
      this.logger.error(`Google Calendar: Failed to update event: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel/delete a calendar event
   */
  async cancelEvent(eventId: string, calendarId = "primary"): Promise<boolean> {
    if (!this.calendar) {
      this.logger.warn("Google Calendar: Service not configured, skipping event cancellation");
      return false;
    }

    try {
      this.logger.log(`Google Calendar: Cancelling event ${eventId}`);

      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: "all", // Notify attendees
      });

      this.logger.log(`Google Calendar: Event ${eventId} cancelled`);
      return true;
    } catch (error: any) {
      this.logger.error(`Google Calendar: Failed to cancel event: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Get free/busy information for a calendar
   */
  async getFreeBusy(
    calendarId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<Array<{ start: Date; end: Date }>> {
    if (!this.calendar) {
      this.logger.warn("Google Calendar: Service not configured");
      return [];
    }

    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: calendarId }],
        },
      });

      const busySlots = response.data.calendars?.[calendarId]?.busy || [];
      
      return busySlots.map((slot: any) => ({
        start: new Date(slot.start!),
        end: new Date(slot.end!),
      }));
    } catch (error: any) {
      this.logger.error(`Google Calendar: Failed to get free/busy: ${error.message}`);
      return [];
    }
  }

  /**
   * List events in a time range
   */
  async listEvents(
    calendarId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<calendar_v3.Schema$Event[]> {
    if (!this.calendar) {
      this.logger.warn("Google Calendar: Service not configured");
      return [];
    }

    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      return response.data.items || [];
    } catch (error: any) {
      this.logger.error(`Google Calendar: Failed to list events: ${error.message}`);
      return [];
    }
  }
}
