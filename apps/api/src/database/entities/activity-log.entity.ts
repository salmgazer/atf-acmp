import { Entity, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { Cohort } from "./cohort.entity";

/**
 * Types of activities that can be tracked
 */
export enum ActivityType {
  // Authentication
  LOGIN = "login",
  LOGOUT = "logout",
  TOKEN_REFRESH = "token_refresh",

  // Page views / Navigation
  PAGE_VIEW = "page_view",
  DASHBOARD_VIEW = "dashboard_view",

  // Actions
  API_REQUEST = "api_request",
  SUBMISSION_CREATE = "submission_create",
  SUBMISSION_UPDATE = "submission_update",
  TEAM_CREATE = "team_create",
  TEAM_UPDATE = "team_update",
  BRIEF_VIEW = "brief_view",
  EVALUATION_CREATE = "evaluation_create",
  MENTOR_SESSION = "mentor_session",
  FORUM_POST = "forum_post",
  CHAT_MESSAGE = "chat_message",
}

/**
 * Portal types for activity tracking
 */
export enum ActivityPortal {
  STAFF = "staff",
  PARTICIPANT = "participant",
  ORGANIZATION = "organization",
  MENTOR = "mentor",
  PUBLIC = "public",
}

/**
 * ActivityLog entity for tracking user activity patterns
 * Designed for efficient aggregation queries (hourly/daily trends)
 */
@Entity("activity_logs")
@Index(["activityType", "createdAt"])
@Index(["userId", "createdAt"])
@Index(["cohortId", "createdAt"])
@Index(["portal", "createdAt"])
@Index(["createdAt"])
// Composite index for efficient hourly aggregation
@Index(["cohortId", "activityType", "createdAt"])
export class ActivityLog extends BaseEntity {
  /**
   * User who performed the activity (null for unauthenticated)
   */
  @Column({ name: "user_id", nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "user_id" })
  user?: User;

  /**
   * Participant ID if activity is from a participant
   */
  @Column({ name: "participant_id", nullable: true })
  participantId?: string;

  /**
   * Cohort context for the activity
   */
  @Column({ name: "cohort_id", nullable: true })
  cohortId?: string;

  @ManyToOne(() => Cohort, { nullable: true })
  @JoinColumn({ name: "cohort_id" })
  cohort?: Cohort;

  /**
   * Type of activity
   */
  @Column({
    name: "activity_type",
    type: "enum",
    enum: ActivityType,
  })
  activityType: ActivityType;

  /**
   * Portal where the activity occurred
   */
  @Column({
    type: "enum",
    enum: ActivityPortal,
    default: ActivityPortal.PUBLIC,
  })
  portal: ActivityPortal;

  /**
   * API endpoint or page path
   */
  @Column({ nullable: true })
  path?: string;

  /**
   * HTTP method for API requests
   */
  @Column({ nullable: true })
  method?: string;

  /**
   * HTTP status code for API requests
   */
  @Column({ name: "status_code", nullable: true })
  statusCode?: number;

  /**
   * Response time in milliseconds
   */
  @Column({ name: "response_time_ms", nullable: true })
  responseTimeMs?: number;

  /**
   * IP address
   */
  @Column({ name: "ip_address", nullable: true })
  ipAddress?: string;

  /**
   * User agent string
   */
  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent?: string;

  /**
   * Additional metadata (entity IDs, etc.)
   */
  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  /**
   * Hour of activity (0-23) - pre-computed for efficient aggregation
   */
  @Column({ name: "hour_of_day", type: "smallint", nullable: true })
  hourOfDay?: number;

  /**
   * Day of week (0=Sunday, 6=Saturday) - pre-computed for efficient aggregation
   */
  @Column({ name: "day_of_week", type: "smallint", nullable: true })
  dayOfWeek?: number;
}
