export const BUILD_DEPLOY_OPTIONS = [
  { value: "confident", label: "Yes, confidently" },
  { value: "with_support", label: "With support" },
  { value: "no", label: "No" },
] as const;
export const MATCHING_ROLE_OPTIONS = [
  { value: "builder", label: "Builder" },
  { value: "sector_specialist", label: "Sector specialist" },
  { value: "business_impact_lead", label: "Users, business and impact lead" },
] as const;
export const MATCHING_SECTOR_OPTIONS = [
  { value: "health", label: "Health" }, { value: "education", label: "Education" },
  { value: "mining_manufacturing", label: "Mining and Manufacturing" }, { value: "agriculture", label: "Agriculture" },
  { value: "finance", label: "Finance" }, { value: "public_service", label: "Public Service" },
  { value: "legal", label: "Legal" }, { value: "logistics", label: "Logistics" }, { value: "other", label: "Other" },
] as const;
export const MATCHING_TEAM_STATUS_OPTIONS = [
  { value: "full_team", label: "Full team" }, { value: "partial_team", label: "Part of a team" }, { value: "need_team", label: "Need a team" },
] as const;
export const GITHUB_USERNAME_PATTERN = /^(?!.*--)[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
export const MATCHING_CONSENT_VERSION = "2026-11-07";
export type BuildDeployAbility = typeof BUILD_DEPLOY_OPTIONS[number]["value"];
export type MatchingRole = typeof MATCHING_ROLE_OPTIONS[number]["value"];
export type MatchingSector = typeof MATCHING_SECTOR_OPTIONS[number]["value"];
export type MatchingTeamStatus = typeof MATCHING_TEAM_STATUS_OPTIONS[number]["value"];
export interface ParticipantMatchingProfile {
  buildDeployAbility?: BuildDeployAbility | null;
  preferredRole?: string | null;
  firstChoiceSector?: MatchingSector | null;
  backupSector?: MatchingSector | null;
  teamStatus?: MatchingTeamStatus | null;
  matchingProfileConsent?: boolean | null;
  matchingProfileConsentAt?: string | null;
  matchingProfileConsentVersion?: string | null;
  matchingProfileCompletedAt?: string | null;
}
export const matchingOptionLabel = (options: readonly { value: string; label: string }[], value?: string | null) => options.find(option => option.value === value)?.label || value || "Not provided";
