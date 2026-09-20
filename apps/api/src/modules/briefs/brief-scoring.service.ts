import { Injectable } from "@nestjs/common";
import {
  BriefFitBand,
  BriefImpactBand,
  ScoringAnswers,
} from "../../database/entities/brief.entity";

/**
 * Scoring configuration matching the Google Apps Script scoring logic
 * Q1-Q6 determine fit score (max 100 points)
 * Q7-Q8 determine impact score (depth x breadth)
 * 
 * NOTE: This logic is kept in sync with @acmp/shared/utils/brief-scoring.ts
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

@Injectable()
export class BriefScoringService {
  /**
   * Calculate all scores for a brief based on scoring answers
   */
  calculateScores(answers: ScoringAnswers): ScoringResult {
    const fitScore = this.calcFitScore(answers);
    const override = this.getOverride(answers);
    const fitBand = this.getFitBand(fitScore, override);

    const depthScore = this.getDepthScore(answers.q7);
    const breadthScore = this.getBreadthScore(answers.q8);
    const impactScore = this.calcImpactScore(depthScore, breadthScore);
    const impactBand = this.getImpactBand(impactScore);
    
    // Calculate priority score (fitScore + impactScore * 10, with overrides penalized)
    const priorityScore = this.calcPriorityScore(fitScore, impactScore, override);

    return {
      fitScore,
      fitBand,
      scoreOverride: override,
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
  private calcFitScore(answers: ScoringAnswers): number {
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
  private getOverride(answers: ScoringAnswers): string | null {
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
  private getFitBand(score: number, override: string | null): BriefFitBand {
    if (override) {
      if (override.includes("digitise")) {
        return BriefFitBand.OVERRIDE_DIGITISE;
      }
      if (override.includes("collect data")) {
        return BriefFitBand.OVERRIDE_COLLECT_DATA;
      }
      if (override.includes("simpler tool")) {
        return BriefFitBand.OVERRIDE_SIMPLER_TOOL;
      }
    }

    if (score >= 70) {
      return BriefFitBand.STRONG_FIT;
    }
    if (score >= 45) {
      return BriefFitBand.PROMISING;
    }
    return BriefFitBand.DIFFERENT_SOLUTION;
  }

  /**
   * Get depth score from Q7 (1-3)
   */
  private getDepthScore(q7?: string): number | null {
    if (!q7) return null;
    return DEPTH_SCORES[q7] ?? null;
  }

  /**
   * Get breadth score from Q8 (1-3)
   */
  private getBreadthScore(q8?: string): number | null {
    if (!q8) return null;
    return BREADTH_SCORES[q8] ?? null;
  }

  /**
   * Calculate impact score (depth x breadth, 1-9)
   */
  private calcImpactScore(
    depth: number | null,
    breadth: number | null
  ): number | null {
    if (depth === null || breadth === null) {
      return null;
    }
    return depth * breadth;
  }

  /**
   * Determine impact band based on impact score
   */
  private getImpactBand(impactScore: number | null): BriefImpactBand | null {
    if (impactScore === null) {
      return null;
    }

    if (impactScore >= 7) {
      return BriefImpactBand.HIGH_IMPACT;
    }
    if (impactScore >= 4) {
      return BriefImpactBand.MODERATE_IMPACT;
    }
    return BriefImpactBand.LOWER_IMPACT;
  }

  /**
   * Calculate priority score (combined metric for sorting)
   * Formula: fitScore + impactScore * 10, with -50 penalty for override cases
   * Score range: roughly -50 to 190 (max fitScore 100 + max impactScore 9 * 10)
   */
  private calcPriorityScore(
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

  /**
   * Get human-readable fit band label
   */
  getFitBandLabel(band: BriefFitBand): string {
    const labels: Record<BriefFitBand, string> = {
      [BriefFitBand.STRONG_FIT]: "Strong fit",
      [BriefFitBand.PROMISING]: "Promising, with groundwork",
      [BriefFitBand.DIFFERENT_SOLUTION]: "Might suit a different solution",
      [BriefFitBand.OVERRIDE_DIGITISE]: "Score override: digitise first",
      [BriefFitBand.OVERRIDE_COLLECT_DATA]: "Score override: collect data first",
      [BriefFitBand.OVERRIDE_SIMPLER_TOOL]: "Score override: simpler tool",
    };
    return labels[band];
  }

  /**
   * Get human-readable impact band label
   */
  getImpactBandLabel(band: BriefImpactBand): string {
    const labels: Record<BriefImpactBand, string> = {
      [BriefImpactBand.HIGH_IMPACT]: "High impact",
      [BriefImpactBand.MODERATE_IMPACT]: "Moderate impact",
      [BriefImpactBand.LOWER_IMPACT]: "Lower impact",
    };
    return labels[band];
  }
}
