import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ZoomMeetingInput {
  title: string;
  description: string;
  startAt: Date;
  durationMinutes: number;
  timezone: string;
}

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private token?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;

  constructor(private readonly config: ConfigService) {}

  isReady(): boolean {
    return ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_HOST_USER_ID"].every(key => !!this.config.get<string>(key));
  }

  get hostId(): string {
    if (!this.isReady()) throw new ServiceUnavailableException("Brief event scheduling requires the shared ATF Zoom account to be configured");
    return this.config.get<string>("ZOOM_HOST_USER_ID")!;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = this.requestToken();
    try { return await this.tokenRequest; }
    finally { this.tokenRequest = undefined; }
  }

  private async requestToken(): Promise<string> {
    if (!this.isReady()) throw new ServiceUnavailableException("Brief event scheduling requires the shared ATF Zoom account to be configured");
    const credentials = Buffer.from(`${this.config.get("ZOOM_CLIENT_ID")}:${this.config.get("ZOOM_CLIENT_SECRET")}`).toString("base64");
    const response = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "account_credentials", account_id: this.config.get<string>("ZOOM_ACCOUNT_ID")! }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new ServiceUnavailableException("The ATF Zoom account could not be authorized. Please contact staff.");
    const result = await response.json();
    if (!result.access_token || !Number.isFinite(result.expires_in)) throw new ServiceUnavailableException("Zoom returned an invalid authorization response");
    this.token = { value: result.access_token, expiresAt: Date.now() + Math.max(0, result.expires_in - 60) * 1000 };
    return this.token.value;
  }

  private async request(path: string, method: string, body?: unknown): Promise<Response> {
    try {
      let response = await this.send(path, method, body);
      if (response.status === 401) {
        this.token = undefined;
        response = await this.send(path, method, body);
      }
      if (!response.ok && !(method === "DELETE" && response.status === 404)) {
        this.logger.warn(`Zoom ${method} failed with HTTP ${response.status}`);
        throw new ServiceUnavailableException("Zoom could not complete the meeting request. Please try again.");
      }
      return response;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Zoom is temporarily unavailable. Please try again.");
    }
  }

  private async send(path: string, method: string, body?: unknown): Promise<Response> {
    return fetch(`https://api.zoom.us/v2${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  }

  private meetingBody(input: ZoomMeetingInput) {
    return { topic: input.title, agenda: input.description, type: 2, start_time: input.startAt.toISOString(), duration: input.durationMinutes, timezone: input.timezone };
  }

  async createMeeting(input: ZoomMeetingInput): Promise<{ id: string; joinUrl: string }> {
    const response = await this.request(`/users/${encodeURIComponent(this.hostId)}/meetings`, "POST", {
      ...this.meetingBody(input), settings: { join_before_host: false, waiting_room: true, participant_video: false, host_video: false },
    });
    const result = await response.json();
    if (!result.id || !result.join_url || !String(result.join_url).startsWith("https://")) throw new ServiceUnavailableException("Zoom returned incomplete meeting details");
    // start_url grants host privileges and must never be persisted or sent to participants.
    return { id: String(result.id), joinUrl: result.join_url };
  }

  async updateMeeting(id: string, input: ZoomMeetingInput): Promise<void> {
    await this.request(`/meetings/${encodeURIComponent(id)}`, "PATCH", this.meetingBody(input));
  }

  async deleteMeeting(id: string): Promise<void> {
    await this.request(`/meetings/${encodeURIComponent(id)}`, "DELETE");
  }

  async getHostUrl(id: string): Promise<string> {
    const response = await this.request(`/meetings/${encodeURIComponent(id)}`, "GET");
    const meeting = await response.json();
    let url: URL;
    try { url = new URL(meeting.start_url); }
    catch { throw new ServiceUnavailableException("Zoom did not return a host link"); }
    if (url.protocol !== "https:" || !["zoom.us", "zoom.com"].some(domain => url.hostname === domain || url.hostname.endsWith("." + domain))) {
      throw new ServiceUnavailableException("Zoom returned an invalid host link");
    }
    return url.toString();
  }
}
