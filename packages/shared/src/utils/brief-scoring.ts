/**
 * Brief Scoring Logic
 * 
 * This module contains the single source of truth for calculating brief fit and impact scores.
 * Used by both frontend (for real-time preview) and backend (for persistence).
 * 
 * Scoring Overview:
 * - Fit Score (Q1-Q6): 0-100 points, measures AI-challenge suitability
 * - Impact Score (Q7-Q8): 1-9, measures potential reach (depth × breadth)
 * - Priority Score: Combined metric for sorting (fitScore + impactScore × 10)
 */

// ============================================================================
// Types
// ============================================================================

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

export type BriefFitBand =
  | "strong_fit"
  | "promising"
  | "different_solution"
  | "override_digitise"
  | "override_collect_data"
  | "override_simpler_tool";

export type BriefImpactBand = "high_impact" | "moderate_impact" | "lower_impact";

export interface ScoringResult {
  fitScore: number;
  fitBand: BriefFitBand;
  scoreOverride: string | null;
  depthScore: number | null;
  breadthScore: number | null;
  impactScore: number | null;
  impactBand: BriefImpactBand | null;
  priorityScore: number;
}

// ============================================================================
// Scoring Constants
// ============================================================================

/**
 * Q1-Q6 scoring matrix (fit score components)
 * Total max: 100 points
 */
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

/**
 * Q7 depth scoring (1-3)
 */
const DEPTH_SCORES: Record<string, number> = {
  convenient: 1,
  meaningful: 2,
  transformative: 3,
};

/**
 * Q8 breadth scoring (1-3)
 */
const BREADTH_SCORES: Record<string, number> = {
  local: 1,
  thousands: 2,
  national: 3,
};

// ============================================================================
// Core Scoring Functions
// ============================================================================

/**
 * Calculate all scores for a brief based on scoring answers.
 * This is the single source of truth for scoring logic.
 */
export function calculateBriefScores(answers: ScoringAnswers): ScoringResult {
  const fitScore = calcFitScore(answers);
  const scoreOverride = getOverride(answers);
  const fitBand = getFitBand(fitScore, scoreOverride);

  const depthScore = getDepthScore(answers.q7);
  const breadthScore = getBreadthScore(answers.q8);
  const impactScore = calcImpactScore(depthScore, breadthScore);
  const impactBand = getImpactBand(impactScore);
  const priorityScore = calcPriorityScore(fitScore, impactScore, scoreOverride);

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

/**
 * Calculate fit score from Q1-Q6 (max 100 points)
 */
function calcFitScore(answers: ScoringAnswers): number {
  let total = 0;
  const questions = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

  for (const q of questions) {
    const key = answers[q];
    const qMap = Q_SCORES[q];
    if (key && qMap && qMap[key] !== undefined) {
      total += qMap[key];
    }
  }

  return total;
}

/**
 * Check for override conditions that supersede the fit score
 */
function getOverride(answers: ScoringAnswers): string | null {
  // No system in place - needs digitization first
  if (answers.q1 === "no_system") {
    return "Score override: digitise first";
  }

  // Very little data - needs data collection first
  if (answers.q2 === "very_little") {
    return "Score override: collect data first";
  }

  // Routine work + straightforward rules = simpler tool would suffice
  if (answers.q1 === "routine" && answers.q3 === "straightforward") {
    return "Score override: simpler tool";
  }

  return null;
}

/**
 * Determine fit band based on score and override
 */
function getFitBand(score: number, override: string | null): BriefFitBand {
  if (override) {
    if (override.includes("digitise")) return "override_digitise";
    if (override.includes("collect data")) return "override_collect_data";
    if (override.includes("simpler tool")) return "override_simpler_tool";
  }

  if (score >= 70) return "strong_fit";
  if (score >= 45) return "promising";
  return "different_solution";
}

/**
 * Get depth score from Q7 (1-3)
 */
function getDepthScore(q7?: string): number | null {
  if (!q7) return null;
  return DEPTH_SCORES[q7] ?? null;
}

/**
 * Get breadth score from Q8 (1-3)
 */
function getBreadthScore(q8?: string): number | null {
  if (!q8) return null;
  return BREADTH_SCORES[q8] ?? null;
}

/**
 * Calculate impact score (depth × breadth, 1-9)
 */
function calcImpactScore(depth: number | null, breadth: number | null): number | null {
  if (depth === null || breadth === null) return null;
  return depth * breadth;
}

/**
 * Determine impact band based on impact score
 */
function getImpactBand(impactScore: number | null): BriefImpactBand | null {
  if (impactScore === null) return null;
  if (impactScore >= 7) return "high_impact";
  if (impactScore >= 4) return "moderate_impact";
  return "lower_impact";
}

/**
 * Calculate priority score (combined metric for sorting)
 * Formula: fitScore + impactScore × 10, with -50 penalty for override cases
 * Score range: roughly -50 to 190 (max fitScore 100 + max impactScore 9 × 10)
 */
function calcPriorityScore(
  fitScore: number,
  impactScore: number | null,
  override: string | null
): number {
  let priority = fitScore;
  if (impactScore !== null) {
    priority += impactScore * 10;
  }
  if (override) {
    priority -= 50; // Penalize override cases
  }
  return priority;
}

// ============================================================================
// Display Helper Functions
// ============================================================================

/**
 * Get human-readable fit band label
 */
export function getFitBandLabel(band: BriefFitBand): string {
  const labels: Record<BriefFitBand, string> = {
    strong_fit: "Strong fit",
    promising: "Promising, with groundwork",
    different_solution: "Might suit a different solution",
    override_digitise: "Digitise first",
    override_collect_data: "Collect data first",
    override_simpler_tool: "Simpler tool may work",
  };
  return labels[band] || band;
}

/**
 * Get human-readable impact band label
 */
export function getImpactBandLabel(band: BriefImpactBand | null): string {
  if (!band) return "";
  const labels: Record<BriefImpactBand, string> = {
    high_impact: "High impact",
    moderate_impact: "Moderate impact",
    lower_impact: "Lower impact",
  };
  return labels[band] || band;
}

/**
 * Get color scheme for fit band display
 */
export function getFitBandColor(band: BriefFitBand): {
  bg: string;
  text: string;
  border: string;
} {
  switch (band) {
    case "strong_fit":
      return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    case "promising":
      return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    case "different_solution":
      return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
    default:
      // Override cases
      return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
  }
}

/**
 * Get color scheme for priority score badge
 */
export function getPriorityBadgeStyle(score?: number | null): {
  bgClass: string;
  textClass: string;
  label: string;
} {
  if (score === undefined || score === null) {
    return { bgClass: "bg-muted", textClass: "text-muted-foreground", label: "—" };
  }
  if (score >= 140) {
    return { bgClass: "bg-emerald-500/15", textClass: "text-emerald-600", label: String(score) };
  }
  if (score >= 100) {
    return { bgClass: "bg-blue-500/15", textClass: "text-blue-600", label: String(score) };
  }
  if (score >= 50) {
    return { bgClass: "bg-amber-500/15", textClass: "text-amber-600", label: String(score) };
  }
  return { bgClass: "bg-red-500/15", textClass: "text-red-600", label: String(score) };
}
