import { Injectable } from "@nestjs/common";
import {
  calculateBriefScores,
  getFitBandLabel,
  getImpactBandLabel,
  type ScoringAnswers,
  type ScoringResult,
  type BriefFitBand,
  type BriefImpactBand,
} from "@acmp/shared";

// Re-export types for consumers that import from this service
export type { ScoringAnswers, ScoringResult, BriefFitBand, BriefImpactBand };

/**
 * Service wrapper around the shared brief scoring utilities.
 * 
 * The actual scoring logic is centralized in @acmp/shared to ensure
 * consistency between frontend and backend. This service provides
 * a NestJS injectable wrapper for use in other services.
 */
@Injectable()
export class BriefScoringService {
  /**
   * Calculate all scores for a brief based on scoring answers.
   * Delegates to the shared calculateBriefScores function.
   */
  calculateScores(answers: ScoringAnswers): ScoringResult {
    return calculateBriefScores(answers);
  }

  /**
   * Get human-readable fit band label
   */
  getFitBandLabel(band: BriefFitBand): string {
    return getFitBandLabel(band);
  }

  /**
   * Get human-readable impact band label
   */
  getImpactBandLabel(band: BriefImpactBand | null): string {
    return getImpactBandLabel(band);
  }
}
