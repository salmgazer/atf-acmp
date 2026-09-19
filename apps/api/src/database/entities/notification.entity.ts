import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";

/**
 * Notification types for different events in the system
 */
export enum NotificationType {
  // Team related
  TEAM_INVITATION = "team_invitation",
  TEAM_INVITATION_ACCEPTED = "team_invitation_accepted",
  TEAM_INVITATION_DECLINED = "team_invitation_declined",
  TEAM_MEMBER_JOINED = "team_member_joined",
  TEAM_MEMBER_LEFT = "team_member_left",
  TEAM_JOIN_REQUEST = "team_join_request",
  TEAM_JOIN_CONFIRMED = "team_join_confirmed",
  TEAM_JOIN_DECLINED = "team_join_declined",
  TEAM_MEMBER_REMOVAL_REQUESTED = "team_member_removal_requested",
  TEAM_MEMBER_REMOVAL_APPROVED = "team_member_removal_approved",
  TEAM_MEMBER_REMOVAL_REJECTED = "team_member_removal_rejected",

  // Mentor related
  MENTOR_ASSIGNED = "mentor_assigned",
  MENTOR_SESSION_SCHEDULED = "mentor_session_scheduled",
  MENTOR_SESSION_REMINDER = "mentor_session_reminder",
  MENTOR_SESSION_REQUESTED = "mentor_session_requested",
  MENTOR_SESSION_CONFIRMED = "mentor_session_confirmed",
  MENTOR_SESSION_DECLINED = "mentor_session_declined",

  // Brief related
  BRIEF_STATUS_CHANGED = "brief_status_changed",
  BRIEF_SUBMITTED = "brief_submitted",
  BRIEF_SELECTED = "brief_selected",

  // Submission related
  SUBMISSION_RECEIVED = "submission_received",
  SUBMISSION_DEADLINE = "submission_deadline",
  SUBMISSION_NEEDS_APPROVAL = "submission_needs_approval",
  SUBMISSION_APPROVED = "submission_approved",
  SUBMISSION_REJECTED = "submission_rejected",
  EVALUATION_COMPLETE = "evaluation_complete",

  // Chat related
  CHAT_MESSAGE = "chat_message",
  CHAT_MENTION = "chat_mention",

  // Forum related
  FORUM_REPLY = "forum_reply",
  FORUM_MENTION = "forum_mention",
  FORUM_THREAD_REPLY = "forum_thread_reply",

  // System related
  ANNOUNCEMENT = "announcement",
  DEADLINE_REMINDER = "deadline_reminder",
  SYSTEM_ALERT = "system_alert",
}

/**
 * Recipient type - who should receive the notification
 */
export enum NotificationRecipientType {
  USER = "user", // Internal staff user
  PARTICIPANT = "participant",
  MENTOR = "mentor",
  ORGANIZATION = "organization",
}

/**
 * Priority levels for notifications
 */
export enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

@Entity("notifications")
@Index(["recipientId", "recipientType", "isRead", "createdAt"])
@Index(["recipientId", "recipientType", "createdAt"])
@Index(["type", "createdAt"])
export class Notification extends BaseEntity {
  /**
   * Recipient ID - can be User, Participant, Mentor, or Organization ID
   */
  @Column({ name: "recipient_id" })
  recipientId: string;

  @Column({
    name: "recipient_type",
    type: "enum",
    enum: NotificationRecipientType,
  })
  recipientType: NotificationRecipientType;

  @Column({ type: "enum", enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: "text" })
  body: string;

  /**
   * Optional short summary for notification previews
   */
  @Column({ type: "text", nullable: true })
  summary?: string;

  /**
   * Additional data for the notification (e.g., IDs for navigation)
   */
  @Column({ type: "jsonb", nullable: true })
  data?: Record<string, any>;

  /**
   * URL to navigate to when notification is clicked
   */
  @Column({ name: "action_url", nullable: true })
  actionUrl?: string;

  /**
   * Icon name for the notification
   */
  @Column({ name: "icon_name", nullable: true })
  iconName?: string;

  /**
   * Read status
   */
  @Column({ name: "is_read", default: false })
  isRead: boolean;

  @Column({ name: "read_at", type: "timestamp", nullable: true })
  readAt?: Date;

  /**
   * Priority level
   */
  @Column({
    type: "enum",
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority: NotificationPriority;

  /**
   * Whether email was sent for this notification
   */
  @Column({ name: "email_sent", default: false })
  emailSent: boolean;

  @Column({ name: "email_sent_at", type: "timestamp", nullable: true })
  emailSentAt?: Date;

  /**
   * Whether push notification was sent
   */
  @Column({ name: "push_sent", default: false })
  pushSent: boolean;

  @Column({ name: "push_sent_at", type: "timestamp", nullable: true })
  pushSentAt?: Date;

  /**
   * Expiration date - notification won't be shown after this date
   */
  @Column({ name: "expires_at", type: "timestamp", nullable: true })
  expiresAt?: Date;

  /**
   * Group key for grouping related notifications
   */
  @Column({ name: "group_key", nullable: true })
  groupKey?: string;
}

/**
 * User notification preferences
 */
@Entity("notification_preferences")
@Index(["userId", "userType"], { unique: true })
export class NotificationPreference extends BaseEntity {
  @Column({ name: "user_id" })
  userId: string;

  @Column({ name: "user_type", type: "enum", enum: NotificationRecipientType })
  userType: NotificationRecipientType;

  /**
   * Enable/disable in-app notifications
   */
  @Column({ name: "in_app_enabled", default: true })
  inAppEnabled: boolean;

  /**
   * Enable/disable email notifications
   */
  @Column({ name: "email_enabled", default: true })
  emailEnabled: boolean;

  /**
   * Enable/disable push notifications
   */
  @Column({ name: "push_enabled", default: true })
  pushEnabled: boolean;

  /**
   * Specific notification type settings (overrides global)
   * Format: { "team_invitation": { email: true, push: false }, ... }
   */
  @Column({ name: "type_settings", type: "jsonb", nullable: true })
  typeSettings?: Record<string, { email?: boolean; push?: boolean; inApp?: boolean }>;

  /**
   * Quiet hours - don't send push/email during these hours
   */
  @Column({ name: "quiet_hours_start", nullable: true })
  quietHoursStart?: string; // e.g., "22:00"

  @Column({ name: "quiet_hours_end", nullable: true })
  quietHoursEnd?: string; // e.g., "08:00"

  /**
   * Timezone for quiet hours
   */
  @Column({ nullable: true })
  timezone?: string;
}

/**
 * Push notification tokens for devices
 */
@Entity("push_tokens")
@Index(["userId", "userType"])
@Index(["token"], { unique: true })
export class PushToken extends BaseEntity {
  @Column({ name: "user_id" })
  userId: string;

  @Column({ name: "user_type", type: "enum", enum: NotificationRecipientType })
  userType: NotificationRecipientType;

  @Column()
  token: string;

  /**
   * Device type
   */
  @Column({ name: "device_type", nullable: true })
  deviceType?: string; // web, ios, android

  /**
   * Device name/identifier
   */
  @Column({ name: "device_name", nullable: true })
  deviceName?: string;

  /**
   * Last active timestamp
   */
  @Column({ name: "last_active_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastActiveAt: Date;

  /**
   * Whether the token is still valid
   */
  @Column({ name: "is_active", default: true })
  isActive: boolean;
}
