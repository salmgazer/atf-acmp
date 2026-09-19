import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NotificationType,
  NotificationPriority,
} from "@/database/entities/notification.entity";

export interface OneSignalNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  url?: string;
  priority?: NotificationPriority;
  type?: NotificationType;
}

export interface OneSignalSendResult {
  success: boolean;
  id?: string;
  recipients?: number;
  errors?: string[];
}

@Injectable()
export class OneSignalService {
  private readonly logger = new Logger(OneSignalService.name);
  private readonly appId: string;
  private readonly apiKey: string;
  private readonly apiUrl = "https://onesignal.com/api/v1";

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>("ONESIGNAL_APP_ID") || "";
    this.apiKey = this.configService.get<string>("ONESIGNAL_REST_API_KEY") || "";

    if (!this.appId || !this.apiKey) {
      this.logger.warn(
        "OneSignal credentials not configured. Push notifications will be disabled."
      );
    }
  }

  /**
   * Check if OneSignal is configured and ready to use
   */
  isConfigured(): boolean {
    return !!(this.appId && this.apiKey);
  }

  /**
   * Send push notification to specific player IDs (device tokens)
   */
  async sendToPlayerIds(
    playerIds: string[],
    payload: OneSignalNotificationPayload
  ): Promise<OneSignalSendResult> {
    if (!this.isConfigured()) {
      this.logger.debug("OneSignal not configured, skipping push notification");
      return { success: false, errors: ["OneSignal not configured"] };
    }

    if (playerIds.length === 0) {
      return { success: true, recipients: 0 };
    }

    try {
      const response = await fetch(`${this.apiUrl}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify({
          app_id: this.appId,
          include_player_ids: playerIds,
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: {
            ...payload.data,
            type: payload.type,
          },
          url: payload.url,
          priority: this.mapPriority(payload.priority),
          // Web-specific settings
          web_push_topic: payload.type,
          // TTL of 24 hours
          ttl: 86400,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error("OneSignal API error:", result);
        return {
          success: false,
          errors: result.errors || ["Unknown error"],
        };
      }

      this.logger.debug(
        `Push notification sent to ${playerIds.length} devices, id: ${result.id}`
      );

      return {
        success: true,
        id: result.id,
        recipients: result.recipients || playerIds.length,
      };
    } catch (error) {
      this.logger.error("Failed to send push notification:", error);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Send push notification to users by external user IDs
   * This requires setting external_user_id when registering devices
   */
  async sendToExternalUserIds(
    externalUserIds: string[],
    payload: OneSignalNotificationPayload
  ): Promise<OneSignalSendResult> {
    if (!this.isConfigured()) {
      this.logger.debug("OneSignal not configured, skipping push notification");
      return { success: false, errors: ["OneSignal not configured"] };
    }

    if (externalUserIds.length === 0) {
      return { success: true, recipients: 0 };
    }

    this.logger.log(`📤 Sending push notification to ${externalUserIds.length} users`);
    this.logger.log(`   Title: ${payload.title}`);
    this.logger.log(`   Body: ${payload.body}`);
    this.logger.log(`   Recipients: ${externalUserIds.join(", ")}`);

    try {
      const requestBody = {
        app_id: this.appId,
        include_external_user_ids: externalUserIds,
        headings: { en: payload.title },
        contents: { en: payload.body },
        data: {
          ...payload.data,
          type: payload.type,
        },
        url: payload.url,
        priority: this.mapPriority(payload.priority),
        // Web-specific settings
        web_push_topic: payload.type,
        // TTL of 24 hours
        ttl: 86400,
        // Target web push
        channel_for_external_user_ids: "push",
      };

      this.logger.debug(`   Request body: ${JSON.stringify(requestBody, null, 2)}`);

      const response = await fetch(`${this.apiUrl}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error(`❌ OneSignal API error: ${JSON.stringify(result)}`);
        return {
          success: false,
          errors: result.errors || ["Unknown error"],
        };
      }

      this.logger.log(`✅ Push notification sent successfully!`);
      this.logger.log(`   Notification ID: ${result.id}`);
      this.logger.log(`   Recipients: ${result.recipients}`);

      return {
        success: true,
        id: result.id,
        recipients: result.recipients,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to send push notification: ${error.message}`);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Send push notification to a segment (e.g., "All", "Active Users")
   */
  async sendToSegment(
    segments: string[],
    payload: OneSignalNotificationPayload
  ): Promise<OneSignalSendResult> {
    if (!this.isConfigured()) {
      this.logger.debug("OneSignal not configured, skipping push notification");
      return { success: false, errors: ["OneSignal not configured"] };
    }

    try {
      const response = await fetch(`${this.apiUrl}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify({
          app_id: this.appId,
          included_segments: segments,
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: {
            ...payload.data,
            type: payload.type,
          },
          url: payload.url,
          priority: this.mapPriority(payload.priority),
          web_push_topic: payload.type,
          ttl: 86400,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error("OneSignal API error:", result);
        return {
          success: false,
          errors: result.errors || ["Unknown error"],
        };
      }

      this.logger.debug(
        `Push notification sent to segments ${segments.join(", ")}, id: ${result.id}`
      );

      return {
        success: true,
        id: result.id,
        recipients: result.recipients,
      };
    } catch (error) {
      this.logger.error("Failed to send push notification:", error);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Send push notification with filters (for complex targeting)
   */
  async sendWithFilters(
    filters: Array<{ field: string; value: string; relation?: string }>,
    payload: OneSignalNotificationPayload
  ): Promise<OneSignalSendResult> {
    if (!this.isConfigured()) {
      this.logger.debug("OneSignal not configured, skipping push notification");
      return { success: false, errors: ["OneSignal not configured"] };
    }

    try {
      const response = await fetch(`${this.apiUrl}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify({
          app_id: this.appId,
          filters,
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: {
            ...payload.data,
            type: payload.type,
          },
          url: payload.url,
          priority: this.mapPriority(payload.priority),
          web_push_topic: payload.type,
          ttl: 86400,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        this.logger.error("OneSignal API error:", result);
        return {
          success: false,
          errors: result.errors || ["Unknown error"],
        };
      }

      this.logger.debug(`Push notification sent with filters, id: ${result.id}`);

      return {
        success: true,
        id: result.id,
        recipients: result.recipients,
      };
    } catch (error) {
      this.logger.error("Failed to send push notification:", error);
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Map our priority enum to OneSignal priority (1-10)
   */
  private mapPriority(priority?: NotificationPriority): number {
    switch (priority) {
      case NotificationPriority.URGENT:
        return 10;
      case NotificationPriority.HIGH:
        return 8;
      case NotificationPriority.LOW:
        return 4;
      case NotificationPriority.NORMAL:
      default:
        return 6;
    }
  }
}
