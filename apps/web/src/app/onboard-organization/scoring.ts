// Client-side scoring logic (mirrors backend)
import { ScoringAnswers, ScoringResult } from "./types";

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

export function calculateScores(answers: ScoringAnswers): ScoringResult {
  const fitScore = calcFitScore(answers);
  const override = getOverride(answers);
  const fitBand = getFitBand(fitScore, override);

  const depthScore = getDepthScore(answers.q7);
  const breadthScore = getBreadthScore(answers.q8);
  const impactScore = calcImpactScore(depthScore, breadthScore);
  const impactBand = getImpactBand(impactScore);

  return {
    fitScore,
    fitBand,
    scoreOverride: override,
    depthScore,
    breadthScore,
    impactScore,
    impactBand,
  };
}

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

function getOverride(answers: ScoringAnswers): string | null {
  if (answers.q1 === "no_system") {
    return "Score override: digitise first";
  }
  if (answers.q2 === "very_little") {
    return "Score override: collect data first";
  }
  if (answers.q1 === "routine" && answers.q3 === "straightforward") {
    return "Score override: simpler tool";
  }
  return null;
}

function getFitBand(score: number, override: string | null): string {
  if (override) {
    if (override.includes("digitise")) return "override_digitise";
    if (override.includes("collect data")) return "override_collect_data";
    if (override.includes("simpler tool")) return "override_simpler_tool";
  }

  if (score >= 70) return "strong_fit";
  if (score >= 45) return "promising";
  return "different_solution";
}

function getDepthScore(q7?: string): number | null {
  if (!q7) return null;
  return DEPTH_SCORES[q7] ?? null;
}

function getBreadthScore(q8?: string): number | null {
  if (!q8) return null;
  return BREADTH_SCORES[q8] ?? null;
}

function calcImpactScore(depth: number | null, breadth: number | null): number | null {
  if (depth === null || breadth === null) return null;
  return depth * breadth;
}

function getImpactBand(impactScore: number | null): string | null {
  if (impactScore === null) return null;
  if (impactScore >= 7) return "high_impact";
  if (impactScore >= 4) return "moderate_impact";
  return "lower_impact";
}

// Human-readable labels
export function getFitBandLabel(band: string): string {
  const labels: Record<string, string> = {
    strong_fit: "Strong fit",
    promising: "Promising, with groundwork",
    different_solution: "Might suit a different solution",
    override_digitise: "Digitise first",
    override_collect_data: "Collect data first",
    override_simpler_tool: "Simpler tool may work",
  };
  return labels[band] || band;
}

export function getImpactBandLabel(band: string | null): string {
  if (!band) return "";
  const labels: Record<string, string> = {
    high_impact: "High impact",
    moderate_impact: "Moderate impact",
    lower_impact: "Lower impact",
  };
  return labels[band] || band;
}

// Colors for verdict display
export function getFitBandColor(band: string): { bg: string; text: string; border: string } {
  switch (band) {
    case "strong_fit":
      return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    case "promising":
      return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    case "different_solution":
      return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
    default:
      return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
  }
}
