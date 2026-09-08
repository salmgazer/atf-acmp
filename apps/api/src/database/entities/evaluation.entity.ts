import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Team } from "./team.entity";
import { Stage } from "./stage.entity";
import { Cohort } from "./cohort.entity";

export enum EvaluationJobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface AIScoreResult {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  explanation: string;
  confidence: number; // 0-1 confidence in the score
}

export interface HumanScoreResult {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export interface EvaluationMetrics {
  codeQuality?: {
    score: number;
    issues: string[];
    strengths: string[];
  };
  commitHistory?: {
    totalCommits: number;
    contributors: number;
    commitFrequency: string;
    score: number;
  };
  documentation?: {
    hasReadme: boolean;
    readmeQuality: number;
    codeComments: number;
  };
  tokensUsed?: number;
  estimatedCost?: number;
}

@Entity("evaluations")
@Index(["teamId", "stageId"])
@Index(["cohortId", "stageId"])
@Unique(["teamId", "stageId"])
export class Evaluation extends BaseEntity {
  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "stage_id" })
  stageId: string;

  @ManyToOne(() => Stage)
  @JoinColumn({ name: "stage_id" })
  stage: Stage;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "ai_scores", type: "jsonb", nullable: true })
  aiScores?: AIScoreResult[];

  @Column({ name: "ai_overall_score", type: "decimal", precision: 5, scale: 2, nullable: true })
  aiOverallScore?: number;

  @Column({ name: "ai_feedback", type: "text", nullable: true })
  aiFeedback?: string;

  @Column({ name: "ai_strengths", type: "jsonb", nullable: true })
  aiStrengths?: string[];

  @Column({ name: "ai_improvements", type: "jsonb", nullable: true })
  aiImprovements?: string[];

  @Column({ name: "human_scores", type: "jsonb", nullable: true })
  humanScores?: HumanScoreResult[];

  @Column({ name: "human_overall_score", type: "decimal", precision: 5, scale: 2, nullable: true })
  humanOverallScore?: number;

  @Column({ name: "human_feedback", type: "text", nullable: true })
  humanFeedback?: string;

  @Column({ name: "final_score", type: "decimal", precision: 5, scale: 2, nullable: true })
  finalScore?: number;

  @Column({ name: "ai_weight", type: "decimal", precision: 3, scale: 2, default: 0.4 })
  aiWeight: number; // Default 40% AI, 60% human

  @Column({ name: "metrics", type: "jsonb", nullable: true })
  metrics?: EvaluationMetrics;

  @Column({ name: "ai_evaluated_at", type: "timestamp", nullable: true })
  aiEvaluatedAt?: Date;

  @Column({ name: "human_evaluated_at", type: "timestamp", nullable: true })
  humanEvaluatedAt?: Date;

  @Column({ name: "human_evaluator_id", nullable: true })
  humanEvaluatorId?: string;

  @Column({ name: "is_published", default: false })
  isPublished: boolean;

  @Column({ name: "published_at", type: "timestamp", nullable: true })
  publishedAt?: Date;

  /**
   * Calculate final weighted score
   */
  calculateFinalScore(): number | null {
    if (this.aiOverallScore == null && this.humanOverallScore == null) {
      return null;
    }

    if (this.humanOverallScore == null) {
      return Number(this.aiOverallScore);
    }

    if (this.aiOverallScore == null) {
      return Number(this.humanOverallScore);
    }

    const aiWeight = Number(this.aiWeight);
    const humanWeight = 1 - aiWeight;
    return (
      Number(this.aiOverallScore) * aiWeight +
      Number(this.humanOverallScore) * humanWeight
    );
  }
}

@Entity("evaluation_jobs")
@Index(["status"])
@Index(["teamId", "stageId"])
@Index(["createdAt"])
export class EvaluationJob extends BaseEntity {
  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "stage_id" })
  stageId: string;

  @ManyToOne(() => Stage)
  @JoinColumn({ name: "stage_id" })
  stage: Stage;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({
    type: "enum",
    enum: EvaluationJobStatus,
    default: EvaluationJobStatus.PENDING,
  })
  status: EvaluationJobStatus;

  @Column({ type: "int", default: 0 })
  progress: number; // 0-100

  @Column({ name: "current_step", nullable: true })
  currentStep?: string;

  @Column({ type: "int", default: 0 })
  attempts: number;

  @Column({ name: "max_attempts", type: "int", default: 3 })
  maxAttempts: number;

  @Column({ type: "text", nullable: true })
  error?: string;

  @Column({ name: "error_stack", type: "text", nullable: true })
  errorStack?: string;

  @Column({ name: "bull_job_id", nullable: true })
  bullJobId?: string;

  @Column({ name: "started_at", type: "timestamp", nullable: true })
  startedAt?: Date;

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt?: Date;

  @Column({ name: "processing_time_ms", type: "int", nullable: true })
  processingTimeMs?: number;

  /**
   * Check if job can be retried
   */
  canRetry(): boolean {
    return (
      this.status === EvaluationJobStatus.FAILED &&
      this.attempts < this.maxAttempts
    );
  }
}
