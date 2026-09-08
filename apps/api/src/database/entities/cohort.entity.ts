import { Entity, Column, OneToMany, Index } from "typeorm";
import { BaseEntity } from "./base.entity";

export enum CohortStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  EVALUATION = "evaluation",
  COMPLETED = "completed",
  ARCHIVED = "archived",
}

export interface CohortDeadlines {
  registrationEnd: string;
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

  @Column({ name: "brief_cap", default: 50 })
  briefCap: number;

  @Column({ name: "max_teams_per_brief", default: 25 })
  maxTeamsPerBrief: number;

  @Column({ name: "leaderboard_config", type: "jsonb", default: {} })
  leaderboardConfig: LeaderboardConfig;

  @Column({ name: "stage_names", type: "jsonb", default: {} })
  stageNames: StageNames;
}
