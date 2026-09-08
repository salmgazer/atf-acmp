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

  @Column({ name: "calendly_link", nullable: true })
  calendlyLink?: string;

  @Column({ name: "linkedin_url", nullable: true })
  linkedinUrl?: string;

  @Column({ name: "max_teams", default: 3 })
  maxTeams: number;

  @Column({ type: "jsonb", name: "vertical_scope", default: [] })
  verticalScope: string[]; // Array of vertical IDs this mentor can work with

  @Column({ name: "firebase_uid", nullable: true })
  firebaseUid?: string;

  @Column({
    type: "enum",
    enum: MentorStatus,
    default: MentorStatus.IMPORTED,
  })
  status: MentorStatus;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @OneToMany(() => MentorAssignment, (assignment) => assignment.mentor)
  assignments: MentorAssignment[];

  @OneToMany(() => MentorSession, (session) => session.mentor)
  sessions: MentorSession[];

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
