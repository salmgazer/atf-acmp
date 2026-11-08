import { Entity, Column, OneToMany, Index, ManyToOne, JoinColumn, Relation } from "typeorm";
import { Stage } from "./stage.entity";
import { BaseEntity } from "./base.entity";

export enum CohortStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  EVALUATION = "evaluation",
  COMPLETED = "completed",
  ARCHIVED = "archived",
}

export interface CohortDeadlines {
  learningCertificationEnd?: string;
  teamFormationEnd: string;
  briefSelectionEnd: string;
  stage1End: string;
  stage2End: string;
  stage3End: string;
  demoDay: string;
}

export interface StageNames {
  stage1?: string;
  stage2?: string;
  stage3?: string;
  demoDay?: string;
}

export interface RubricConfig {
  criteria: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
}

export interface LeaderboardConfig {
  isPublic?: boolean;
  showScores?: boolean;
  contributingStageIds?: string[];
}

@Entity("cohorts")
@Index(["status"])
export class Cohort extends BaseEntity {
  @Column({ name: "team_joining_stage_id", type: "uuid", nullable: true }) teamJoiningStageId: string | null;
  @ManyToOne(() => Stage, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "team_joining_stage_id", foreignKeyConstraintName: "cohort_team_joining_stage_fk" }) teamJoiningStage: Relation<Stage> | null;
  @Column({ name: "learning_certification_stage_id", type: "uuid", nullable: true }) learningCertificationStageId: string | null;
  @ManyToOne(() => Stage, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "learning_certification_stage_id", foreignKeyConstraintName: "cohort_learning_certification_stage_fk" }) learningCertificationStage: Relation<Stage> | null;
  // Resolved from stage rows for rule evaluation; never persisted as a date copy.
  teamRuleDeadlines?: { joining: string | null; certification: string | null };
  teamRuleDeadlineVersion?: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "enum", enum: CohortStatus, default: CohortStatus.DRAFT })
  status: CohortStatus;

  @Column({ name: "team_size_min", default: 3 })
  teamSizeMin: number;

  @Column({ name: "team_size_max", default: 5 })
  teamSizeMax: number;

  @Column({ type: "jsonb", default: {} })
  deadlines: CohortDeadlines;

  @Column({ type: "jsonb", nullable: true })
  rubric?: RubricConfig;

  @Column({ type: "jsonb", default: [] })
  countries: string[];

  @Column({ type: "jsonb", default: [] })
  verticals: string[];

  @Column({ type: 'jsonb', default: [] })
  groups: string[];

  @Column({ name: "brief_cap", default: 50 })
  briefCap: number;

  @Column({ name: "max_teams_per_brief", default: 25 })
  maxTeamsPerBrief: number;

  @Column({ name: "leaderboard_config", type: "jsonb", default: {} })
  leaderboardConfig: LeaderboardConfig;

  @Column({ name: "stage_names", type: "jsonb", default: {} })
  stageNames: StageNames;

  @Column({
    name: "session_rate",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  sessionRate: number; // Default rate paid per mentor session (can be overridden per mentor)
}
