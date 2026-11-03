import { BadRequestException } from "@nestjs/common";

export interface RubricCriterion { id: string; name: string; maxScore: number; weight: number; description?: string }
export const DEFAULT_EVALUATION_CRITERIA: RubricCriterion[] = [
  { id: "innovation", name: "Innovation & Creativity", maxScore: 10, weight: 25, description: "Originality and creative approach" },
  { id: "feasibility", name: "Technical Feasibility", maxScore: 10, weight: 25, description: "Technical viability and implementation evidence" },
  { id: "presentation", name: "Presentation Quality", maxScore: 10, weight: 25, description: "Clarity and quality of the submitted materials" },
  { id: "impact", name: "Potential Impact", maxScore: 10, weight: 25, description: "Positive impact and scalability" },
];

export function scoreAgainstRubric(criteria: RubricCriterion[], scores: Array<{ criterionId: string; score: number; maxScore?: number }>): number {
  if (!criteria?.length || !Array.isArray(scores) || scores.length !== criteria.length || new Set(scores.map(s => s.criterionId)).size !== scores.length) throw new BadRequestException("Score every rubric criterion exactly once");
  if (new Set(criteria.map(c => c.id)).size !== criteria.length || Math.abs(criteria.reduce((sum, c) => sum + c.weight, 0) - 100) > 0.001) throw new BadRequestException("Invalid rubric configuration");
  let result = 0;
  for (const criterion of criteria) {
    const item = scores.find(s => s.criterionId === criterion.id);
    if (!item || !Number.isFinite(item.score) || !Number.isFinite(criterion.maxScore) || criterion.maxScore <= 0 || !Number.isFinite(criterion.weight) || criterion.weight < 0 || item.score < 0 || item.score > criterion.maxScore || (item.maxScore !== undefined && item.maxScore !== criterion.maxScore)) throw new BadRequestException("Score is outside the configured rubric");
    result += item.score / criterion.maxScore * criterion.weight;
  }
  return Math.round(result * 100) / 100;
}
