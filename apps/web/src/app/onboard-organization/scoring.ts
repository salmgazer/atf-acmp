/**
 * Brief Scoring - Re-exported from @acmp/shared
 * 
 * This file re-exports the shared scoring utilities for use in the
 * onboard-organization form. The scoring logic is centralized in
 * @acmp/shared to ensure consistency between frontend and backend.
 */

import {
  calculateBriefScores,
  getFitBandLabel,
  getImpactBandLabel,
  getFitBandColor,
  getPriorityBadgeStyle,
} from "@acmp/shared";

export type {
  ScoringAnswers,
  ScoringResult,
  BriefFitBand,
  BriefImpactBand,
} from "@acmp/shared";

// Re-export functions
export {
  calculateBriefScores,
  getFitBandLabel,
  getImpactBandLabel,
  getFitBandColor,
  getPriorityBadgeStyle,
};

// Alias for backward compatibility with existing imports
export const calculateScores = calculateBriefScores;
