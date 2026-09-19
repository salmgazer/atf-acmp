import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { Organization } from "./organization.entity";
import { Vertical } from "./vertical.entity";

export enum BriefStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  IN_REVIEW = "in_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  REVISION_REQUESTED = "revision_requested",
}

export enum BriefFitBand {
  STRONG_FIT = "strong_fit",
  PROMISING = "promising",
  DIFFERENT_SOLUTION = "different_solution",
  OVERRIDE_DIGITISE = "override_digitise",
  OVERRIDE_COLLECT_DATA = "override_collect_data",
  OVERRIDE_SIMPLER_TOOL = "override_simpler_tool",
}

export enum BriefImpactBand {
  HIGH_IMPACT = "high_impact",
  MODERATE_IMPACT = "moderate_impact",
  LOWER_IMPACT = "lower_impact",
}

export interface SecondaryContact {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface ScoringAnswers {
  q1?: string;
  q1_text?: string;
  q2?: string;
  q2_text?: string;
  q3?: string;
  q3_text?: string;
  q4?: string;
  q4_text?: string;
  q5?: string;
  q5_text?: string;
  q6?: string;
  q6_text?: string;
  q7?: string;
  q7_text?: string;
  q8?: string;
  q8_text?: string;
}

// Scoring calculation utilities
const Q_SCORES: Record<string, Record<string, number>> = {
  q1: {
    routine: 0,
    judgement: 25,
    sense_making: 25,
    no_system: 0,
    new_capability: 25,
  },
  q2: {
    good_records: 25,
    partial: 12,
    very_little: 0,
  },
  q3: {
    straightforward: 0,
    mixed: 10,
    hard: 15,
  },
  q4: {
    yes: 10,
    no_exact: 0,
  },
  q5: {
    clear: 15,
    vague: 5,
  },
  q6: {
    very_often: 10,
    now_and_then: 3,
  },
};

const DEPTH_SCORES: Record<string, number> = {
  convenient: 1,
  meaningful: 2,
  transformative: 3,
};

const BREADTH_SCORES: Record<string, number> = {
  local: 1,
  thousands: 2,
  national: 3,
};

export function calculateBriefScores(answers: ScoringAnswers): {
  fitScore: number;
  fitBand: BriefFitBand;
  scoreOverride: string | null;
  depthScore: number | null;
  breadthScore: number | null;
  impactScore: number | null;
  impactBand: BriefImpactBand | null;
  priorityScore: number;
} {
  // Calculate fit score (0-100)
  let fitScore = 0;
  const questions = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;
  for (const q of questions) {
    const key = answers[q];
    const qMap = Q_SCORES[q];
    if (key && qMap && qMap[key] !== undefined) {
      fitScore += qMap[key];
    }
  }

  // Check for overrides
  let scoreOverride: string | null = null;
  if (answers.q1 === "no_system") {
    scoreOverride = "Score override: digitise first";
  } else if (answers.q2 === "very_little") {
    scoreOverride = "Score override: collect data first";
  } else if (answers.q1 === "routine" && answers.q3 === "straightforward") {
    scoreOverride = "Score override: simpler tool";
  }

  // Determine fit band
  let fitBand: BriefFitBand;
  if (scoreOverride) {
    if (scoreOverride.includes("digitise")) fitBand = BriefFitBand.OVERRIDE_DIGITISE;
    else if (scoreOverride.includes("collect data")) fitBand = BriefFitBand.OVERRIDE_COLLECT_DATA;
    else fitBand = BriefFitBand.OVERRIDE_SIMPLER_TOOL;
  } else if (fitScore >= 70) {
    fitBand = BriefFitBand.STRONG_FIT;
  } else if (fitScore >= 45) {
    fitBand = BriefFitBand.PROMISING;
  } else {
    fitBand = BriefFitBand.DIFFERENT_SOLUTION;
  }

  // Calculate impact scores
  const depthScore = answers.q7 && DEPTH_SCORES[answers.q7] !== undefined ? DEPTH_SCORES[answers.q7] : null;
  const breadthScore = answers.q8 && BREADTH_SCORES[answers.q8] !== undefined ? BREADTH_SCORES[answers.q8] : null;
  const impactScore = depthScore !== null && breadthScore !== null ? depthScore * breadthScore : null;

  // Determine impact band
  let impactBand: BriefImpactBand | null = null;
  if (impactScore !== null) {
    if (impactScore >= 7) impactBand = BriefImpactBand.HIGH_IMPACT;
    else if (impactScore >= 4) impactBand = BriefImpactBand.MODERATE_IMPACT;
    else impactBand = BriefImpactBand.LOWER_IMPACT;
  }

  // Calculate priority score (combined metric for sorting: fitScore + impactScore * 10)
  // This gives a score range of roughly 0-190 (max fitScore 100 + max impactScore 9 * 10)
  // Override briefs get a penalty of -50 to rank them lower
  let priorityScore = fitScore;
  if (impactScore !== null) {
    priorityScore += impactScore * 10;
  }
  if (scoreOverride) {
    priorityScore -= 50; // Penalize override cases
  }

  return {
    fitScore,
    fitBand,
    scoreOverride,
    depthScore,
    breadthScore,
    impactScore,
    impactBand,
    priorityScore,
  };
}

@Entity("briefs")
@Index(["cohortId", "status"])
@Index(["organizationId"])
@Index(["verticalId"])
@Index(["sessionId"])
export class Brief extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "text", name: "problem_statement" })
  problemStatement: string;

  @Column({ type: "text", name: "expected_outcomes" })
  expectedOutcomes: string;

  @Column({ name: "vertical_id", nullable: true })
  verticalId?: string;

  @ManyToOne(() => Vertical, { nullable: true })
  @JoinColumn({ name: "vertical_id" })
  vertical?: Vertical;

  @Column({ type: "enum", enum: BriefStatus, default: BriefStatus.DRAFT })
  status: BriefStatus;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "organization_id" })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: "organization_id" })
  organization: Organization;

  // Public submission fields
  @Column({ name: "session_id", nullable: true })
  sessionId?: string;

  @Column({ name: "opportunity_number", nullable: true })
  opportunityNumber?: number;

  @Column({ type: "text", name: "what_changes", nullable: true })
  whatChanges?: string;

  @Column({ name: "affected_count", nullable: true })
  affectedCount?: string;

  @Column({ type: "text", name: "data_description", nullable: true })
  dataDescription?: string;

  @Column({ name: "data_access", nullable: true })
  dataAccess?: string;

  @Column({ type: "jsonb", name: "secondary_contact", nullable: true })
  secondaryContact?: SecondaryContact;

  @Column({ type: "jsonb", name: "scoring_answers", nullable: true })
  scoringAnswers?: ScoringAnswers;

  // Fit scoring
  @Column({ name: "fit_score", nullable: true })
  fitScore?: number;

  @Column({ type: "enum", enum: BriefFitBand, name: "fit_band", nullable: true })
  fitBand?: BriefFitBand;

  @Column({ name: "score_override", nullable: true })
  scoreOverride?: string;

  // Impact scoring
  @Column({ name: "depth_score", nullable: true })
  depthScore?: number;

  @Column({ name: "breadth_score", nullable: true })
  breadthScore?: number;

  @Column({ name: "impact_score", nullable: true })
  impactScore?: number;

  @Column({ type: "enum", enum: BriefImpactBand, name: "impact_band", nullable: true })
  impactBand?: BriefImpactBand;

  // Combined priority score for sorting (fitScore + impactScore * 10, with overrides penalized)
  @Column({ name: "priority_score", nullable: true, default: 0 })
  priorityScore?: number;

  @Column({ type: "text", name: "country_lead_notes", nullable: true })
  countryLeadNotes?: string;

  @Column({ name: "teams_count", default: 0 })
  teamsCount: number;

  @Column({ name: "max_teams", default: 25 })
  maxTeams: number;

  @Column({ type: "jsonb", default: [] })
  tags: string[];

  @Column({ type: "jsonb", nullable: true })
  resources?: Array<{
    name: string;
    url: string;
    type: string;
  }>;

  // Video pitch (Stage B)
  @Column({ name: "video_url", nullable: true })
  videoUrl?: string;

  @Column({ name: "video_thumbnail_url", nullable: true })
  videoThumbnailUrl?: string;

  @Column({ type: "jsonb", name: "image_urls", default: [] })
  imageUrls: string[];

  // Review fields
  @Column({ type: "text", name: "review_feedback", nullable: true })
  reviewFeedback?: string;

  @Column({ name: "reviewed_by", nullable: true })
  reviewedBy?: string;

  @Column({ name: "reviewed_at", nullable: true })
  reviewedAt?: Date;

  @Column({ name: "submitted_at", nullable: true })
  submittedAt?: Date;

  @Column({ name: "approved_at", nullable: true })
  approvedAt?: Date;

  @Column({ name: "revision_count", default: 0 })
  revisionCount: number;

  @Column({ name: "current_version", default: 1 })
  currentVersion: number;

  @OneToMany(() => BriefRevision, (revision) => revision.brief)
  revisions: BriefRevision[];
}

export enum BriefRevisionAction {
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
  REVISION_REQUESTED = "revision_requested",
  UPDATED = "updated",
  RESTORED = "restored",
}

export enum BriefRevisionActorType {
  ORGANIZATION = "organization",
  STAFF = "staff",
  SYSTEM = "system",
}

@Entity("brief_revisions")
@Index(["briefId"])
export class BriefRevision extends BaseEntity {
  @Column({ name: "brief_id" })
  briefId: string;

  @ManyToOne(() => Brief, (brief) => brief.revisions)
  @JoinColumn({ name: "brief_id" })
  brief: Brief;

  @Column({ type: "enum", enum: BriefRevisionAction })
  action: BriefRevisionAction;

  @Column({ name: "version", default: 1 })
  version: number;

  @Column({ name: "actor_id", nullable: true })
  actorId?: string;

  @Column({ name: "actor_name", nullable: true })
  actorName?: string;

  @Column({ type: "enum", enum: BriefRevisionActorType, name: "actor_type", nullable: true })
  actorType?: BriefRevisionActorType;

  @Column({ type: "text", nullable: true })
  comment?: string;

  @Column({ type: "jsonb", nullable: true })
  previousData?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  newData?: Record<string, any>;
}
