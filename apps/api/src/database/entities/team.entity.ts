import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { Brief } from "./brief.entity";
import { Participant } from "./participant.entity";
import { Mentor } from "./mentor.entity";

export enum TeamStatus {
  FORMING = "forming",
  ACTIVE = "active",
  SUBMITTED = "submitted",
  EVALUATED = "evaluated",
  DISQUALIFIED = "disqualified",
}

export enum TeamRole {
  LEAD = "lead",
  CO_LEAD = "co_lead",
  MEMBER = "member",
}

export enum InvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

/**
 * Status for team members - supports pending approval workflow
 */
export enum TeamMemberStatus {
  PENDING = "pending",     // Requested to join, awaiting team lead approval
  CONFIRMED = "confirmed", // Approved and active member
}

/**
 * Status for member removal requests
 */
export enum RemovalRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

@Entity("teams")
@Index(["cohortId", "status"])
@Index(["briefId"])
export class Team extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "enum", enum: TeamStatus, default: TeamStatus.FORMING })
  status: TeamStatus;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "brief_id", nullable: true })
  briefId?: string;

  @ManyToOne(() => Brief, { nullable: true })
  @JoinColumn({ name: "brief_id" })
  brief?: Brief;

  @Column({ name: "mentor_id", nullable: true })
  mentorId?: string;

  @ManyToOne(() => Mentor, { nullable: true })
  @JoinColumn({ name: "mentor_id" })
  mentor?: Mentor;

  @Column({ name: "invite_code", unique: true })
  inviteCode: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: "github_repo_url", nullable: true })
  githubRepoUrl?: string;

  @Column({ name: "disqualification_reason", nullable: true })
  disqualificationReason?: string;

  @Column({ name: "disqualified_at", nullable: true })
  disqualifiedAt?: Date;

  @Column({ name: "disqualified_by", nullable: true })
  disqualifiedBy?: string;

  @OneToMany(() => TeamMember, (member) => member.team, { cascade: true })
  members: TeamMember[];

  @OneToMany(() => TeamInvitation, (invitation) => invitation.team, { cascade: true })
  invitations: TeamInvitation[];

  /**
   * Get confirmed member count (excludes pending members)
   */
  get memberCount(): number {
    return this.members?.filter((m) => m.status === TeamMemberStatus.CONFIRMED).length || 0;
  }

  /**
   * Get all members count including pending
   */
  get totalMemberCount(): number {
    return this.members?.length || 0;
  }

  /**
   * Get pending member count
   */
  get pendingMemberCount(): number {
    return this.members?.filter((m) => m.status === TeamMemberStatus.PENDING).length || 0;
  }

  /**
   * Get team lead (must be confirmed)
   */
  get lead(): TeamMember | undefined {
    return this.members?.find((m) => m.role === TeamRole.LEAD && m.status === TeamMemberStatus.CONFIRMED);
  }

  /**
   * Get confirmed members only
   */
  get confirmedMembers(): TeamMember[] {
    return this.members?.filter((m) => m.status === TeamMemberStatus.CONFIRMED) || [];
  }

  /**
   * Get pending members only
   */
  get pendingMembers(): TeamMember[] {
    return this.members?.filter((m) => m.status === TeamMemberStatus.PENDING) || [];
  }

  /**
   * Check if team is full based on cohort max team size
   */
  isFull(maxSize: number): boolean {
    return this.memberCount >= maxSize;
  }
}

@Entity("team_members")
@Index(["teamId"])
@Index(["participantId"])
@Unique(["teamId", "participantId"])
export class TeamMember extends BaseEntity {
  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team, (team) => team.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "participant_id" })
  participantId: string;

  @ManyToOne(() => Participant, { eager: true })
  @JoinColumn({ name: "participant_id" })
  participant: Participant;

  @Column({ type: "enum", enum: TeamRole, default: TeamRole.MEMBER })
  role: TeamRole;

  @Column({ type: "enum", enum: TeamMemberStatus, default: TeamMemberStatus.CONFIRMED })
  status: TeamMemberStatus;

  @Column({ name: "joined_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  joinedAt: Date;

  @Column({ name: "confirmed_at", type: "timestamp", nullable: true })
  confirmedAt?: Date;

  @Column({ name: "confirmed_by", nullable: true })
  confirmedBy?: string;
}

@Entity("team_invitations")
@Index(["teamId"])
@Index(["participantId"])
@Index(["status"])
@Unique(["teamId", "participantId", "status"]) // Prevent duplicate pending invitations
export class TeamInvitation extends BaseEntity {
  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team, (team) => team.invitations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "participant_id" })
  participantId: string;

  @ManyToOne(() => Participant)
  @JoinColumn({ name: "participant_id" })
  participant: Participant;

  @Column({ name: "invited_by" })
  invitedBy: string;

  @ManyToOne(() => Participant)
  @JoinColumn({ name: "invited_by" })
  inviter: Participant;

  @Column({ type: "enum", enum: InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus;

  @Column({ type: "text", nullable: true })
  message?: string;

  @Column({ name: "invited_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  invitedAt: Date;

  @Column({ name: "responded_at", type: "timestamp", nullable: true })
  respondedAt?: Date;

  @Column({ name: "expires_at", type: "timestamp", nullable: true })
  expiresAt?: Date;

  /**
   * Check if invitation is expired
   */
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  /**
   * Check if invitation can be responded to
   */
  canRespond(): boolean {
    return this.status === InvitationStatus.PENDING && !this.isExpired();
  }
}

/**
 * Tracks requests for removing confirmed team members
 * Pending members can be removed immediately without staff approval
 * Confirmed members require staff approval
 */
@Entity("team_member_removal_requests")
@Index(["teamId"])
@Index(["memberId"])
@Index(["status"])
export class TeamMemberRemovalRequest extends BaseEntity {
  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "member_id", nullable: true })
  memberId: string | null;

  @ManyToOne(() => TeamMember, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "member_id" })
  member: TeamMember | null;

  @Column({ name: "participant_id" })
  participantId: string;

  @ManyToOne(() => Participant)
  @JoinColumn({ name: "participant_id" })
  participant: Participant;

  @Column({ name: "requested_by" })
  requestedBy: string;

  @ManyToOne(() => Participant)
  @JoinColumn({ name: "requested_by" })
  requester: Participant;

  @Column({ type: "enum", enum: RemovalRequestStatus, default: RemovalRequestStatus.PENDING })
  status: RemovalRequestStatus;

  @Column({ type: "text", nullable: true })
  reason?: string;

  @Column({ name: "requested_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  requestedAt: Date;

  @Column({ name: "resolved_at", type: "timestamp", nullable: true })
  resolvedAt?: Date;

  @Column({ name: "resolved_by", nullable: true })
  resolvedBy?: string;

  @Column({ name: "resolution_notes", type: "text", nullable: true })
  resolutionNotes?: string;
}
