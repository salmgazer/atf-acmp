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

export enum StageType {
  DOCUMENT = "document",
  VIDEO = "video",
  URL = "url",
  TEXT = "text",
  MIXED = "mixed",
}

export enum SubmissionStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  LATE = "late",
  EVALUATED = "evaluated",
}

export interface StageRequirements {
  documentRequired?: boolean;
  documentMaxSize?: number; // in MB
  documentTypes?: string[]; // ['pdf', 'docx']
  videoRequired?: boolean;
  videoMaxDuration?: number; // in seconds
  videoMaxSize?: number; // in MB
  urlRequired?: boolean;
  urlLabel?: string; // e.g., 'GitHub Repository', 'Demo Video'
  githubRequired?: boolean;
  textRequired?: boolean;
  textLabel?: string; // e.g., 'Problem Statement', 'Executive Summary'
  textMinLength?: number;
  textMaxLength?: number;
  additionalFields?: Array<{
    name: string;
    label: string;
    type: "text" | "textarea" | "url";
    required: boolean;
    placeholder?: string;
  }>;
}

@Entity("stages")
@Index(["cohortId", "number"])
@Index(["cohortId", "isActive"])
export class Stage extends BaseEntity {
  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column()
  number: number;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: true })
  instructions?: string;

  @Column({ type: "enum", enum: StageType, default: StageType.MIXED })
  type: StageType;

  @Column({ name: "start_date", type: "timestamp", nullable: true })
  startDate?: Date;

  @Column({ type: "timestamp" })
  deadline: Date;

  @Column({ type: "jsonb", default: {} })
  requirements: StageRequirements;

  @Column({ name: "weight_percentage", type: "decimal", precision: 5, scale: 2, default: 0 })
  weightPercentage: number;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({ name: "allow_late_submissions", default: true })
  allowLateSubmissions: boolean;

  @Column({ name: "late_penalty_percentage", type: "decimal", precision: 5, scale: 2, default: 0 })
  latePenaltyPercentage: number;

  @Column({ name: "sort_order", default: 0 })
  sortOrder: number;

  @OneToMany(() => Submission, (submission) => submission.stage)
  submissions: Submission[];

  /**
   * Check if stage is currently open for submissions
   */
  isOpen(): boolean {
    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (!this.allowLateSubmissions && now > this.deadline) return false;
    return this.isActive;
  }

  /**
   * Check if current time is past deadline
   */
  isPastDeadline(): boolean {
    return new Date() > this.deadline;
  }
}

@Entity("submissions")
@Index(["teamId", "stageId"], { unique: true })
@Index(["stageId", "status"])
@Index(["submittedAt"])
export class Submission extends BaseEntity {
  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "stage_id" })
  stageId: string;

  @ManyToOne(() => Stage, (stage) => stage.submissions)
  @JoinColumn({ name: "stage_id" })
  stage: Stage;

  @Column({ type: "enum", enum: SubmissionStatus, default: SubmissionStatus.DRAFT })
  status: SubmissionStatus;

  @Column({ type: "jsonb", default: {} })
  content: Record<string, any>;

  @Column({ name: "file_urls", type: "jsonb", default: [] })
  fileUrls: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedAt?: string;
  }>;

  @Column({ name: "github_url", nullable: true })
  githubUrl?: string;

  @Column({ name: "video_url", nullable: true })
  videoUrl?: string;

  @Column({ name: "submitted_at", type: "timestamp", nullable: true })
  submittedAt?: Date;

  @Column({ name: "submitted_by", nullable: true })
  submittedBy?: string;

  @Column({ name: "is_late", default: false })
  isLate: boolean;

  @Column({ name: "late_minutes", default: 0 })
  lateMinutes: number;

  // Evaluation fields
  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  score?: number;

  @Column({ name: "evaluated_at", type: "timestamp", nullable: true })
  evaluatedAt?: Date;

  @Column({ name: "evaluated_by", nullable: true })
  evaluatedBy?: string;

  @Column({ name: "evaluation_notes", type: "text", nullable: true })
  evaluationNotes?: string;

  @Column({ type: "jsonb", nullable: true })
  feedback?: {
    strengths?: string[];
    improvements?: string[];
    comments?: string;
  };

  @Column({ name: "version", default: 1 })
  version: number;

  @Column({ name: "last_saved_at", type: "timestamp", nullable: true })
  lastSavedAt?: Date;
}

@Entity("submission_history")
@Index(["submissionId"])
@Index(["savedAt"])
export class SubmissionHistory extends BaseEntity {
  @Column({ name: "submission_id" })
  submissionId: string;

  @ManyToOne(() => Submission, { onDelete: "CASCADE" })
  @JoinColumn({ name: "submission_id" })
  submission: Submission;

  @Column()
  version: number;

  @Column({ type: "jsonb" })
  content: Record<string, any>;

  @Column({ name: "file_urls", type: "jsonb", default: [] })
  fileUrls: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;

  @Column({ name: "github_url", nullable: true })
  githubUrl?: string;

  @Column({ name: "video_url", nullable: true })
  videoUrl?: string;

  @Column({ name: "saved_by" })
  savedBy: string;

  @Column({ name: "saved_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  savedAt: Date;
}
