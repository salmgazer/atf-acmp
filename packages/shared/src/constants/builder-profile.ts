/** Language and proficiency describe the participant; only the three experiences qualify a builder. */
export const PROGRAMMING_LANGUAGES = ["Python", "JavaScript", "TypeScript", "Java", "C", "C#", "C++", "Go", "PHP", "Ruby", "Rust", "Swift", "Kotlin", "R", "SQL", "Other"] as const;
export const LANGUAGE_PROFICIENCIES = ["Beginner", "Intermediate", "Advanced", "Expert"] as const;
export const BUILDER_EXPERIENCES = [
  { key: "developmentExperience", label: "Development", explanation: "I have built an application or feature using my preferred language." },
  { key: "testingExperience", label: "Testing", explanation: "I have tested an application, checked its behaviour and fixed problems." },
  { key: "deploymentExperience", label: "Deployment", explanation: "I have deployed an application so other people can use it online." },
] as const;
export interface BuilderProfile {
  preferredLanguage?: string | null;
  otherLanguage?: string | null;
  languageProficiency?: string | null;
  developmentExperience?: boolean | null;
  testingExperience?: boolean | null;
  deploymentExperience?: boolean | null;
  builderConfirm?: boolean;
}
export type BuilderAnswers = Required<Omit<BuilderProfile, "builderConfirm">>;
export function validateBuilderProfile(profile: BuilderProfile): string | null {
  if (BUILDER_EXPERIENCES.some(({ key }) => typeof profile[key] !== "boolean")) return "Answer Yes or No for development, testing and deployment experience.";
  if (BUILDER_EXPERIENCES.every(({ key }) => profile[key] === false) && !profile.preferredLanguage) return null;
  if (!PROGRAMMING_LANGUAGES.includes(profile.preferredLanguage as typeof PROGRAMMING_LANGUAGES[number])) return "Select your preferred programming language (or Other).";
  if (profile.preferredLanguage === "Other" && !profile.otherLanguage?.trim()) return "Enter your preferred programming language.";
  if (!LANGUAGE_PROFICIENCIES.includes(profile.languageProficiency as typeof LANGUAGE_PROFICIENCIES[number])) return "Select your proficiency level. It does not affect builder qualification.";
  return null;
}

/** Recorded skill tags are evidence for a prefill, never proof of a favourite language. */
export function recordedProgrammingLanguages(skills: readonly string[] = []): string[] {
  const aliases: Record<string, string[]> = {"python": ["Python"], "javascript": ["JavaScript"], "js": ["JavaScript"], "typescript": ["TypeScript"], "ts": ["TypeScript"], "javascript/typescript": ["JavaScript", "TypeScript"], "javascript / typescript": ["JavaScript", "TypeScript"], "c": ["C"], "c++": ["C++"], "c/c++": ["C", "C++"], "c#": ["C#"], "csharp": ["C#"], "java": ["Java"], "r": ["R"], "sql": ["SQL"], "go": ["Go"], "golang": ["Go"], "php": ["PHP"], "ruby": ["Ruby"], "rust": ["Rust"], "swift": ["Swift"], "kotlin": ["Kotlin"]};
  return [...new Set(skills.flatMap(skill => aliases[skill.trim().toLowerCase()] || []))].sort();
}
export function languagePrefill(profile: { skills?: string[]; pythonSkill?: string | null }) {
  const candidates = recordedProgrammingLanguages(profile.skills);
  const pythonLevel = profile.pythonSkill?.trim().match(/^(beginner|intermediate|advanced|expert)\b/i)?.[1];
  const preferredLanguage = candidates.length === 1 ? candidates[0] : candidates.length > 1 ? null : pythonLevel ? "Python" : null;
  return { preferredLanguage, languageProficiency: preferredLanguage === "Python" && pythonLevel ? pythonLevel[0].toUpperCase() + pythonLevel.slice(1).toLowerCase() : null };
}
