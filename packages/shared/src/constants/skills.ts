/**
 * Skills categorization for participant matching
 * Used by both frontend (onboarding) and backend (team formation)
 */

export type SkillCategory = "tech" | "non-tech";

export interface SkillDefinition {
  name: string;
  category: SkillCategory;
}

/**
 * Technical skills - programming, data, AI/ML, etc.
 */
export const TECH_SKILLS = [
  "Python",
  "JavaScript/TypeScript",
  "R",
  "C/C++",
  "Java",
  "SQL",
  "Machine Learning",
  "Data Science",
  "Mobile Development",
] as const;

/**
 * Non-technical skills - business, design, communication, etc.
 */
export const NON_TECH_SKILLS = [
  "UI/UX Design",
  "Project Management",
  "Business Strategy",
  "Research",
  "Content Writing",
  "Marketing",
  "Public Speaking",
] as const;

/**
 * All skills combined for UI display
 */
export const ALL_SKILLS: SkillDefinition[] = [
  // Tech skills
  ...TECH_SKILLS.map((name) => ({ name, category: "tech" as const })),
  // Non-tech skills
  ...NON_TECH_SKILLS.map((name) => ({ name, category: "non-tech" as const })),
];

/**
 * Flat array of all skill names for validation
 */
export const SKILL_NAMES = [...TECH_SKILLS, ...NON_TECH_SKILLS] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

/**
 * Lookup map for quick category checking
 */
export const SKILL_CATEGORY_MAP: Record<string, SkillCategory> = Object.fromEntries(
  ALL_SKILLS.map((s) => [s.name, s.category])
);

/**
 * Helper function to check if a skill is technical
 */
export function isTechSkill(skill: string): boolean {
  return SKILL_CATEGORY_MAP[skill] === "tech";
}

/**
 * Helper function to check if a skill is non-technical
 */
export function isNonTechSkill(skill: string): boolean {
  return SKILL_CATEGORY_MAP[skill] === "non-tech";
}

/**
 * Classify a participant based on their skills
 */
export type ParticipantSkillProfile = "technical" | "non-technical" | "hybrid";

export function classifyParticipantSkills(skills: string[]): ParticipantSkillProfile {
  const techCount = skills.filter(isTechSkill).length;
  const nonTechCount = skills.filter(isNonTechSkill).length;

  if (techCount > 0 && nonTechCount === 0) return "technical";
  if (nonTechCount > 0 && techCount === 0) return "non-technical";
  return "hybrid";
}

/**
 * Get skill breakdown for a participant
 */
export function getSkillBreakdown(skills: string[]): {
  tech: string[];
  nonTech: string[];
  techCount: number;
  nonTechCount: number;
  profile: ParticipantSkillProfile;
} {
  const tech = skills.filter(isTechSkill);
  const nonTech = skills.filter(isNonTechSkill);

  return {
    tech,
    nonTech,
    techCount: tech.length,
    nonTechCount: nonTech.length,
    profile: classifyParticipantSkills(skills),
  };
}

/**
 * Interest areas (separate from skills, but useful for team matching)
 */
export const INTEREST_OPTIONS = [
  "Artificial Intelligence",
  "Climate & Sustainability",
  "Healthcare & Medicine",
  "Education",
  "FinTech",
  "Agriculture",
  "E-commerce",
  "Social Impact",
  "Entertainment",
  "Transportation",
] as const;

export type InterestName = (typeof INTEREST_OPTIONS)[number];
