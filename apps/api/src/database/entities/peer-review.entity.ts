import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { Team } from "./team.entity";
import { Stage } from "./stage.entity";
import { Participant } from "./participant.entity";

export enum PeerReviewAssignmentStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  SKIPPED = "skipped",
}

export interface PeerReviewScore {
  criterionId: string;
  criterionName: string;
  score: number; // 1-5 or 1-10 depending on config
  maxScore: number;
  comment?: string;
}

@Entity("peer_review_assignments")
@Index(["cohortId", "stageId"])
@Index(["reviewerTeamId", "status"])
@Index(["reviewedTeamId"])
@Unique(["reviewerTeamId", "reviewedTeamId", "stageId"])
export class PeerReviewAssignment extends BaseEntity {
  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "stage_id" })
  stageId: string;

  @ManyToOne(() => Stage)
  @JoinColumn({ name: "stage_id" })
  stage: Stage;

  @Column({ name: "reviewer_team_id" })
  reviewerTeamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "reviewer_team_id" })
  reviewerTeam: Team;

  @Column({ name: "reviewed_team_id" })
  reviewedTeamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "reviewed_team_id" })
  reviewedTeam: Team;

  @Column({
    type: "enum",
    enum: PeerReviewAssignmentStatus,
    default: PeerReviewAssignmentStatus.PENDING,
  })
  status: PeerReviewAssignmentStatus;

  @Column({ name: "due_date", type: "timestamp" })
  dueDate: Date;

  @Column({ name: "assigned_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  assignedAt: Date;

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt?: Date;

  /**
   * Check if assignment is overdue
   */
  isOverdue(): boolean {
    return new Date() > this.dueDate && this.status !== PeerReviewAssignmentStatus.COMPLETED;
  }
}

@Entity("peer_reviews")
@Index(["assignmentId"])
@Index(["submittedAt"])
export class PeerReview extends BaseEntity {
  @Column({ name: "assignment_id" })
  assignmentId: string;

  @ManyToOne(() => PeerReviewAssignment)
  @JoinColumn({ name: "assignment_id" })
  assignment: PeerReviewAssignment;

  @Column({ name: "reviewer_participant_id" })
  reviewerParticipantId: string;

  @ManyToOne(() => Participant)
  @JoinColumn({ name: "reviewer_participant_id" })
  reviewerParticipant: Participant;

  @Column({ type: "jsonb" })
  scores: PeerReviewScore[];

  @Column({ name: "overall_score", type: "decimal", precision: 5, scale: 2 })
  overallScore: number;

  @Column({ name: "overall_comment", type: "text", nullable: true })
  overallComment?: string;

  @Column({ type: "jsonb", nullable: true })
  strengths?: string[];

  @Column({ type: "jsonb", nullable: true })
  improvements?: string[];

  @Column({ name: "is_anonymous", default: true })
  isAnonymous: boolean;

  @Column({ name: "submitted_at", type: "timestamp" })
  submittedAt: Date;

  @Column({ name: "time_spent_minutes", nullable: true })
  timeSpentMinutes?: number;

  @Column({ name: "is_flagged", default: false })
  isFlagged: boolean;

  @Column({ name: "flag_reason", nullable: true })
  flagReason?: string;
}

@Entity("peer_review_rubrics")
@Index(["cohortId", "stageId"])
export class PeerReviewRubric extends BaseEntity {
  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "stage_id", nullable: true })
  stageId?: string;

  @ManyToOne(() => Stage, { nullable: true })
  @JoinColumn({ name: "stage_id" })
  stage?: Stage;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "jsonb" })
  criteria: Array<{
    id: string;
    name: string;
    description: string;
    weight: number;
    maxScore: number;
    levels?: Array<{
      score: number;
      label: string;
      description: string;
    }>;
  }>;

  @Column({ name: "is_active", default: true })
  isActive: boolean;
}
