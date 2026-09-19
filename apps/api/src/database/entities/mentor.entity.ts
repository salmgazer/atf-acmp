import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { Team } from "./team.entity";

export enum MentorStatus {
  IMPORTED = "imported",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

/**
 * Build capabilities that mentors can specialize in
 * Based on the Gated Claim Mentor Allocation model
 */
export enum MentorCapability {
  RETRIEVAL_RAG = "retrieval_rag",
  COMPUTER_VISION = "computer_vision",
  SPEECH_ASR = "speech_asr",
  TABULAR_ML = "tabular_ml",
  AGENTS = "agents",
  FINE_TUNING = "fine_tuning",
  MOBILE_EDGE = "mobile_edge",
  DATA_ENGINEERING = "data_engineering",
}

export const MENTOR_CAPABILITY_LABELS: Record<MentorCapability, string> = {
  [MentorCapability.RETRIEVAL_RAG]: "Retrieval / RAG",
  [MentorCapability.COMPUTER_VISION]: "Computer Vision",
  [MentorCapability.SPEECH_ASR]: "Speech & ASR",
  [MentorCapability.TABULAR_ML]: "Tabular ML",
  [MentorCapability.AGENTS]: "Agents",
  [MentorCapability.FINE_TUNING]: "Fine-tuning",
  [MentorCapability.MOBILE_EDGE]: "Mobile & Edge",
  [MentorCapability.DATA_ENGINEERING]: "Data Engineering",
};

@Entity("mentors")
@Index(["cohortId", "status"])
@Index(["email"], { unique: true })
export class Mentor extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ name: "first_name" })
  firstName: string;

  @Column({ name: "last_name" })
  lastName: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  company?: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ type: "text", nullable: true })
  bio?: string;

  @Column({ name: "profile_image_url", nullable: true })
  profileImageUrl?: string;

  @Column({ type: "jsonb", default: [] })
  expertise: string[];

  @Column({ type: "jsonb", default: [] })
  capabilities: MentorCapability[]; // Build capabilities for gated claim model

  @Column({ name: "google_calendar_id", nullable: true })
  googleCalendarId?: string; // For Google Calendar integration

  @Column({ name: "linkedin_url", nullable: true })
  linkedinUrl?: string;

  @Column({ name: "max_teams", default: 3 })
  maxTeams: number;

  @Column({ name: "max_claims", default: 3 })
  maxClaims: number; // Maximum active claims (for gated claim model)

  @Column({ type: "jsonb", name: "vertical_scope", default: [] })
  verticalScope: string[]; // Array of vertical IDs this mentor can work with

  @Column({ name: "firebase_uid", nullable: true })
  firebaseUid?: string;

  @Column({
    name: "session_rate_override",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  sessionRateOverride?: number; // Override rate for this mentor (null = use cohort default)

  @Column({
    type: "enum",
    enum: MentorStatus,
    default: MentorStatus.ACTIVE,
  })
  status: MentorStatus;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @OneToMany(() => MentorAssignment, (assignment) => assignment.mentor)
  assignments: MentorAssignment[];

  @OneToMany(() => MentorClaim, (claim) => claim.mentor)
  claims: MentorClaim[];

  @OneToMany(() => MentorSession, (session) => session.mentor)
  sessions: MentorSession[];

  @OneToMany(() => MentorAvailability, (availability) => availability.mentor)
  availabilitySlots: MentorAvailability[];

  @OneToMany(() => MentorAvailabilityException, (exception) => exception.mentor)
  availabilityExceptions: MentorAvailabilityException[];

  @OneToMany(() => MentorPayment, (payment) => payment.mentor)
  payments: MentorPayment[];

  /**
   * Get full name
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Get assigned teams count
   */
  get assignedTeamsCount(): number {
    return this.assignments?.filter((a) => a.isActive)?.length || 0;
  }

  /**
   * Check if mentor has capacity for more teams
   */
  hasCapacity(): boolean {
    return this.assignedTeamsCount < this.maxTeams;
  }

  /**
   * Get available slots
   */
  get availableSlots(): number {
    return Math.max(0, this.maxTeams - this.assignedTeamsCount);
  }

  /**
   * Get active claims count (for gated claim model)
   */
  get activeClaimsCount(): number {
    return this.claims?.filter((c) => c.status === MentorClaimStatus.ACTIVE)?.length || 0;
  }

  /**
   * Check if mentor has capacity for more claims
   */
  hasClaimCapacity(): boolean {
    return this.activeClaimsCount < this.maxClaims;
  }

  /**
   * Get available claim slots
   */
  get availableClaimSlots(): number {
    return Math.max(0, this.maxClaims - this.activeClaimsCount);
  }

  /**
   * Get the effective session rate for this mentor
   * Uses mentor's override if set, otherwise falls back to cohort's default rate
   */
  getSessionRate(): number {
    if (this.sessionRateOverride !== null && this.sessionRateOverride !== undefined) {
      return Number(this.sessionRateOverride);
    }
    return this.cohort?.sessionRate ? Number(this.cohort.sessionRate) : 0;
  }
}

/**
 * Status of a mentor claim in the gated claim model
 */
export enum MentorClaimStatus {
  ACTIVE = "active",           // Claim is active, sessions can be booked
  EXPIRED = "expired",         // Claim expired (session 1 not booked within 14 days)
  COMPLETED = "completed",     // All 3 sessions completed
  RELEASED = "released",       // Released by mentor or auto-released
  SWAPPED = "swapped",         // Team used their one-time swap
}

/**
 * MentorClaim - Tracks team-mentor pairings in the gated claim model
 * A team claims a mentor and gets exclusive access for 3 sessions
 */
@Entity("mentor_claims")
@Index(["mentorId"])
@Index(["teamId"])
@Index(["status"])
// Note: Unique constraint for active claims is handled by a partial index in migration
// to allow re-claiming after release
export class MentorClaim extends BaseEntity {
  @Column({ name: "mentor_id" })
  mentorId: string;

  @ManyToOne(() => Mentor, (mentor) => mentor.claims, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mentor_id" })
  mentor: Mentor;

  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "claimed_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  claimedAt: Date;

  @Column({ name: "claimed_by" })
  claimedBy: string; // Participant ID who made the claim

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt: Date; // 14 days from claim for session 1 to be booked

  @Column({
    type: "enum",
    enum: MentorClaimStatus,
    default: MentorClaimStatus.ACTIVE,
  })
  status: MentorClaimStatus;

  @Column({ name: "session_count", default: 0 })
  sessionCount: number; // Number of sessions completed (max 3)

  @Column({ name: "swap_used", default: false })
  swapUsed: boolean; // Whether the one-time swap has been used

  @Column({ name: "proposal_snapshot", type: "jsonb", nullable: true })
  proposalSnapshot?: Record<string, any>; // Snapshot of proposal at claim time

  @Column({ name: "released_at", type: "timestamp", nullable: true })
  releasedAt?: Date;

  @Column({ name: "release_reason", nullable: true })
  releaseReason?: string; // team_initiated, mentor_initiated, non_response, expired

  @Column({ name: "previous_claim_id", nullable: true })
  previousClaimId?: string; // If this is a swap, reference to original claim

  @OneToMany(() => ScheduledSession, (session) => session.claim)
  scheduledSessions: ScheduledSession[];

  /**
   * Check if claim is still valid for booking
   */
  isValidForBooking(): boolean {
    return this.status === MentorClaimStatus.ACTIVE && this.sessionCount < 3;
  }

  /**
   * Check if claim has expired
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt && this.sessionCount === 0;
  }
}

/**
 * Status of a scheduled session
 */
export enum ScheduledSessionStatus {
  SCHEDULED = "scheduled",     // Session is scheduled, awaiting mentor confirmation
  CONFIRMED = "confirmed",     // Mentor accepted/confirmed the session
  DECLINED = "declined",       // Mentor declined the session request
  COMPLETED = "completed",     // Session completed
  CANCELLED = "cancelled",     // Session cancelled (by team or system)
  NO_SHOW = "no_show",         // One party didn't show up
  RESCHEDULED = "rescheduled", // Session was rescheduled
}

/**
 * ScheduledSession - Tracks individual booked sessions with Google Calendar integration
 */
@Entity("scheduled_sessions")
@Index(["claimId"])
@Index(["mentorId"])
@Index(["teamId"])
@Index(["scheduledAt"])
@Index(["googleEventId"])
export class ScheduledSession extends BaseEntity {
  @Column({ name: "claim_id" })
  claimId: string;

  @ManyToOne(() => MentorClaim, (claim) => claim.scheduledSessions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "claim_id" })
  claim: MentorClaim;

  @Column({ name: "mentor_id" })
  mentorId: string;

  @ManyToOne(() => Mentor, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mentor_id" })
  mentor: Mentor;

  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "session_number" })
  sessionNumber: number; // 1, 2, or 3

  @Column({ name: "scheduled_at", type: "timestamp" })
  scheduledAt: Date;

  @Column({ name: "duration_minutes", default: 45 })
  durationMinutes: number;

  @Column({ type: "text" })
  question: string; // Required: specific question team wants answered

  @Column({
    type: "enum",
    enum: ScheduledSessionStatus,
    default: ScheduledSessionStatus.SCHEDULED,
  })
  status: ScheduledSessionStatus;

  @Column({ name: "google_event_id", nullable: true })
  googleEventId?: string; // Google Calendar event ID

  @Column({ name: "google_calendar_link", nullable: true })
  googleCalendarLink?: string; // Direct link to Google Calendar event

  @Column({ name: "google_meet_link", nullable: true })
  googleMeetLink?: string; // Google Meet link for the session

  @Column({ name: "booked_by" })
  bookedBy: string; // Participant ID who booked the session

  @Column({ name: "booked_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  bookedAt: Date;

  @Column({ name: "confirmed_by_mentor", default: false })
  confirmedByMentor: boolean;

  @Column({ name: "confirmed_at", type: "timestamp", nullable: true })
  confirmedAt?: Date;

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt?: Date;

  @Column({ name: "cancelled_at", type: "timestamp", nullable: true })
  cancelledAt?: Date;

  @Column({ name: "cancel_reason", nullable: true })
  cancelReason?: string;

  @Column({ name: "cancelled_by", nullable: true })
  cancelledBy?: string; // team or mentor

  @Column({ name: "declined_at", type: "timestamp", nullable: true })
  declinedAt?: Date;

  @Column({ name: "decline_reason", nullable: true })
  declineReason?: string;

  @Column({ type: "text", nullable: true })
  notes?: string; // Post-session notes

  @Column({ type: "jsonb", name: "action_items", default: [] })
  actionItems: string[];

  @Column({ name: "mentor_feedback", type: "text", nullable: true })
  mentorFeedback?: string;

  @Column({ name: "team_feedback", type: "text", nullable: true })
  teamFeedback?: string;

  @Column({ name: "rating", type: "int", nullable: true })
  rating?: number; // 1-5 rating from team
}

@Entity("mentor_assignments")
@Index(["mentorId"])
@Index(["teamId"])
@Index(["mentorId", "teamId"], { unique: true })
export class MentorAssignment extends BaseEntity {
  @Column({ name: "mentor_id" })
  mentorId: string;

  @ManyToOne(() => Mentor, (mentor) => mentor.assignments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mentor_id" })
  mentor: Mentor;

  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "assigned_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  assignedAt: Date;

  @Column({ name: "assigned_by", nullable: true })
  assignedBy?: string; // Staff user ID who made the assignment

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({ name: "unassigned_at", type: "timestamp", nullable: true })
  unassignedAt?: Date;

  @Column({ name: "unassign_reason", nullable: true })
  unassignReason?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;
}

@Entity("mentor_sessions")
@Index(["mentorId"])
@Index(["teamId"])
@Index(["sessionDate"])
export class MentorSession extends BaseEntity {
  @Column({ name: "mentor_id" })
  mentorId: string;

  @ManyToOne(() => Mentor, (mentor) => mentor.sessions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mentor_id" })
  mentor: Mentor;

  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "session_date", type: "timestamp" })
  sessionDate: Date;

  @Column({ name: "duration_minutes" })
  durationMinutes: number;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ type: "jsonb", name: "topics_discussed", default: [] })
  topicsDiscussed: string[];

  @Column({ type: "jsonb", name: "action_items", default: [] })
  actionItems: string[];

  @Column({ type: "text", name: "team_progress_notes", nullable: true })
  teamProgressNotes?: string;

  @Column({ type: "text", name: "next_session_goals", nullable: true })
  nextSessionGoals?: string;

  @Column({ name: "session_type", default: "regular" })
  sessionType: string; // regular, check-in, workshop, etc.
}

/**
 * Days of the week for availability
 */
export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.SUNDAY]: "Sunday",
  [DayOfWeek.MONDAY]: "Monday",
  [DayOfWeek.TUESDAY]: "Tuesday",
  [DayOfWeek.WEDNESDAY]: "Wednesday",
  [DayOfWeek.THURSDAY]: "Thursday",
  [DayOfWeek.FRIDAY]: "Friday",
  [DayOfWeek.SATURDAY]: "Saturday",
};

/**
 * MentorAvailability - Recurring weekly time slots when a mentor is available
 * Mentors set up their weekly schedule, and teams can book within these slots
 */
@Entity("mentor_availability")
@Index(["mentorId"])
@Index(["mentorId", "dayOfWeek"])
export class MentorAvailability extends BaseEntity {
  @Column({ name: "mentor_id" })
  mentorId: string;

  @ManyToOne(() => Mentor, (mentor) => mentor.availabilitySlots, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mentor_id" })
  mentor: Mentor;

  @Column({ name: "day_of_week", type: "int" })
  dayOfWeek: DayOfWeek; // 0 = Sunday, 6 = Saturday

  @Column({ name: "start_time", type: "time" })
  startTime: string; // e.g., "10:00:00"

  @Column({ name: "end_time", type: "time" })
  endTime: string; // e.g., "12:00:00"

  @Column({ name: "duration_minutes", default: 45 })
  durationMinutes: number; // Duration of each session slot

  @Column({ name: "buffer_minutes", default: 15 })
  bufferMinutes: number; // Buffer between sessions

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({ name: "timezone", default: "Africa/Nairobi" })
  timezone: string; // Timezone for this availability slot

  /**
   * Calculate how many slots are available in this time window
   */
  get slotCount(): number {
    const [startHour, startMin] = this.startTime.split(":").map(Number);
    const [endHour, endMin] = this.endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const totalMinutes = endMinutes - startMinutes;
    const slotWithBuffer = this.durationMinutes + this.bufferMinutes;
    return Math.floor(totalMinutes / slotWithBuffer);
  }
}

/**
 * MentorAvailabilityException - One-off overrides to the weekly schedule
 * Used for vacations, special days, or custom hours on specific dates
 */
@Entity("mentor_availability_exceptions")
@Index(["mentorId"])
@Index(["mentorId", "date"])
export class MentorAvailabilityException extends BaseEntity {
  @Column({ name: "mentor_id" })
  mentorId: string;

  @ManyToOne(() => Mentor, (mentor) => mentor.availabilityExceptions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mentor_id" })
  mentor: Mentor;

  @Column({ type: "date" })
  date: string; // The specific date (YYYY-MM-DD)

  @Column({ name: "is_unavailable", default: false })
  isUnavailable: boolean; // If true, mentor is not available this entire day

  @Column({ type: "jsonb", name: "custom_slots", nullable: true })
  customSlots?: {
    startTime: string;
    endTime: string;
    durationMinutes?: number;
  }[]; // Custom time slots for this specific day (overrides weekly schedule)

  @Column({ type: "text", nullable: true })
  reason?: string; // Optional reason (vacation, holiday, etc.)
}

/**
 * Status of a mentor payment
 */
export enum MentorPaymentStatus {
  PENDING = "pending",     // Payment is scheduled but not yet made
  COMPLETED = "completed", // Payment has been made
  FAILED = "failed",       // Payment failed
  CANCELLED = "cancelled", // Payment was cancelled
}

/**
 * MentorPayment - Tracks payments made to mentors for their sessions
 */
@Entity("mentor_payments")
@Index(["mentorId"])
@Index(["status"])
@Index(["paidAt"])
@Index(["createdAt"])
export class MentorPayment extends BaseEntity {
  @Column({ name: "mentor_id" })
  mentorId: string;

  @ManyToOne(() => Mentor, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mentor_id" })
  mentor: Mentor;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  amount: number; // Total payment amount

  @Column({
    type: "enum",
    enum: MentorPaymentStatus,
    default: MentorPaymentStatus.PENDING,
  })
  status: MentorPaymentStatus;

  @Column({ name: "sessions_count", default: 0 })
  sessionsCount: number; // Number of sessions this payment covers

  @Column({ name: "session_ids", type: "jsonb", default: [] })
  sessionIds: string[]; // IDs of ScheduledSessions included in this payment

  @Column({ name: "period_start", type: "date", nullable: true })
  periodStart?: string; // Start of payment period (YYYY-MM-DD)

  @Column({ name: "period_end", type: "date", nullable: true })
  periodEnd?: string; // End of payment period (YYYY-MM-DD)

  @Column({ name: "paid_at", type: "timestamp", nullable: true })
  paidAt?: Date; // When payment was made

  @Column({ name: "paid_by", nullable: true })
  paidBy?: string; // Staff user ID who recorded the payment

  @Column({ name: "payment_reference", nullable: true })
  paymentReference?: string; // External payment reference (e.g., bank transfer ID)

  @Column({ name: "payment_method", nullable: true })
  paymentMethod?: string; // bank_transfer, mobile_money, etc.

  @Column({ type: "text", nullable: true })
  notes?: string; // Additional notes about the payment
}
