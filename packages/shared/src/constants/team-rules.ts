const COUNTRY_NAMES: Record<string, string> = { GH: "Ghana", NG: "Nigeria", KE: "Kenya", ZA: "South Africa" };
import type { ParticipantMatchingProfile, MatchingSector } from "./participant-matching";

export const ATF_TEAM_MIN = 3;
export const ATF_TEAM_MAX = 5;
export interface TeamRuleParticipant {
  id: string; country: string; cohortId: string; group?: string | null; status?: string; onboardingComplete?: boolean;
  programmeOptedOut?: boolean; codeLabsCompleted?: boolean; pythonSkill?: string | null; fieldOfStudy?: string | null;
  gender?: string | null; institution?: string | null; learningHalfwayReached?: boolean | null;
  learningFinishedAllLessons?: boolean | null; learningCertificateIssued?: boolean | null;
  learningCertificateId?: string | null; learningCertificateDate?: string | null;
  preference?: (Pick<ParticipantMatchingProfile, "buildDeployAbility" | "preferredRole" | "firstChoiceSector" | "backupSector" | "teamStatus"> & { matchingProfileCompletedAt?: string | Date | null; crossCountryWilling?: boolean }) | null;
}
export interface TeamRuleCohort {
  id: string; status?: string; groups?: string[]; teamSizeMin?: number; teamSizeMax?: number;
  teamRuleDeadlines?: { joining?: string | null; certification?: string | null };
}
export interface TeamRuleIssue { code: string; message: string; participantId?: string }
export interface TeamRuleReport {
  canRegister: boolean; canStartChallenge: boolean; registrationIssues: TeamRuleIssue[]; challengeIssues: TeamRuleIssue[];
  guidance: string[]; builderCount: number; nonComputingCount: number; sectorSpecialistCount: number;
  impactLeadCount: number; femaleCount: number; institutionCount: number; countries: string[];
  competitionCountries: string[]; teamSize: number; joinDeadline: string | null; certificateDeadline: string | null;
}
export const normalizeTeamCountry = (value?: string | null) => {
  const text = (value || "").trim();
  return Object.entries(COUNTRY_NAMES).find(([code, name]) => code.toLowerCase() === text.toLowerCase() || name.toLowerCase() === text.toLowerCase())?.[1] || text;
};
export const isQualifiedBuilder = (p: TeamRuleParticipant) => p.codeLabsCompleted === true ||
  (/^(intermediate|advanced|expert)\b/i.test((p.pythonSkill || "").trim()) && p.preference?.buildDeployAbility === "confident");
export const hasNonComputingStudy = (p: TeamRuleParticipant) => {
  const study = (p.fieldOfStudy || "").trim();
  return !!study && !/^(n\/?a|unknown|not specified|not provided|none|other|prefer not to say)$/i.test(study)
    && !/(computer\s*(science|engineering)|information\s*(technology|systems)|software\s*engineering|\bcomputing\b|\bict\b|\bit\b)/i.test(study);
};
export function participantTeamIssues(p: TeamRuleParticipant, cohort: TeamRuleCohort): TeamRuleIssue[] {
  const issues: TeamRuleIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message, participantId: p.id });
  if (p.cohortId !== cohort.id) add("cohort", "Member must belong to this cohort");
  if (p.programmeOptedOut) add("opt_out", "Participant has opted out of the programme");
  if (p.status === "inactive") add("inactive", "Participant is inactive");
  if (!p.onboardingComplete || !p.preference?.matchingProfileCompletedAt) add("onboarding", "Complete the matching questions before joining a team");
  if (p.learningHalfwayReached !== true) add("halfway", "At least 20 of the 40 learning lessons must be completed");
  if (!normalizeTeamCountry(p.country)) add("country", "Confirm country of residence");
  if (cohort.groups?.length && (!p.group || !cohort.groups.includes(p.group))) add("group", "Assign a valid cohort group before joining a team");
  return issues;
}
export function canShareTeam(members: TeamRuleParticipant[]): boolean {
  if (new Set(members.map(p => p.group || null)).size > 1) return false;
  const countries = new Set(members.map(p => normalizeTeamCountry(p.country).toLowerCase()));
  return countries.size <= 1 || members.every(p => p.preference?.crossCountryWilling === true);
}
export function sectorStudyMatch(p: TeamRuleParticipant, sector?: MatchingSector | string | null): boolean {
  const patterns: Record<string, RegExp> = {
    health: /health|medicin|nurs|pharmac|biomed|public health/i, education: /educat|teach|pedagog/i,
    agriculture: /agric|agronom|food|animal|veterinar/i, finance: /business|econom|financ|account|commerce/i,
    legal: /\blaw\b|legal|juris/i, mining_manufacturing: /mining|manufactur|mechanical|industrial|material|metallurg/i,
    public_service: /public admin|public policy|political|government|social work/i,
    logistics: /logistic|supply chain|transport|operations/i,
  };
  return !!sector && !!p.fieldOfStudy && !!patterns[sector]?.test(p.fieldOfStudy);
}
export function evaluateTeamRules(cohort: TeamRuleCohort, members: TeamRuleParticipant[], options: {
  competitionCountry?: string | null; problemCountry?: string | null; hasBrief?: boolean;
  registeredAt?: string | Date | null; challengeStartedAt?: string | Date | null; now?: Date;
} = {}): TeamRuleReport {
  const now = options.now || new Date(), registrationIssues = members.flatMap(p => participantTeamIssues(p, cohort));
  const add = (code: string, message: string) => registrationIssues.push({ code, message });
  const joinDeadline = cohort.teamRuleDeadlines?.joining || null;
  const certificateDeadline = cohort.teamRuleDeadlines?.certification || null;
  if (joinDeadline && certificateDeadline && Date.parse(joinDeadline) > Date.parse(certificateDeadline)) add("stage_deadline_order", "Staff must set the learning-certification stage deadline on or after the team-joining stage deadline");
  if (cohort.status && cohort.status !== "active") add("cohort_inactive", "The cohort must be active");
  if (members.length < ATF_TEAM_MIN || members.length > ATF_TEAM_MAX) add("size", "A registered team must have 3 to 5 confirmed members");
  if (new Set(members.map(p => p.id)).size !== members.length) add("duplicate", "Every team member must be unique");
  if (!joinDeadline || !Number.isFinite(Date.parse(joinDeadline))) add("joining_stage", "Staff must select a team-joining deadline stage for this cohort");
  else if (!options.registeredAt && now.getTime() > Date.parse(joinDeadline)) add("deadline", "The team joining and registration deadline has passed");
  const builderCount = members.filter(isQualifiedBuilder).length, nonComputingCount = members.filter(hasNonComputingStudy).length;
  if (!builderCount) add("builder", "Include at least one qualified builder: Intermediate/Advanced/Expert Python with confident build/deploy ability, or staff-verified CodeLabs completion");
  if (!nonComputingCount) add("non_computing", "Include at least one member with a confirmed field of study outside Computer Science, IT and Software Engineering");
  if (!canShareTeam(members)) add("group_country", "Members must share a cohort group; every member of a cross-country team must have opted in");
  const countries = [...new Set(members.map(p => normalizeTeamCountry(p.country)).filter(Boolean))];
  const competitionCountry = normalizeTeamCountry(options.competitionCountry);
  if (!competitionCountry || !countries.some(country => country.toLowerCase() === competitionCountry.toLowerCase())) add("competition_country", "Choose a competition country where at least one member lives");
  const problemCountry = normalizeTeamCountry(options.problemCountry);
  if (options.hasBrief && (!problemCountry || problemCountry.toLowerCase() !== competitionCountry.toLowerCase())) add("problem_country", "The assigned problem must be based in the team's competition country");
  const challengeIssues = [...registrationIssues];
  if (!options.registeredAt) challengeIssues.push({ code: "unregistered", message: "Register the team before starting the challenge" });
  if (!options.hasBrief) challengeIssues.push({ code: "brief", message: "An approved challenge brief must be assigned" });
  if (!certificateDeadline || !Number.isFinite(Date.parse(certificateDeadline || ""))) challengeIssues.push({ code: "certificate_deadline", message: "Staff must select a learning-certification deadline stage for this cohort" });
  for (const p of members) {
    if (p.learningFinishedAllLessons !== true || p.learningCertificateIssued !== true || !p.learningCertificateId?.trim()) {
      challengeIssues.push({ code: "certificate", participantId: p.id, message: "Complete all 40 lessons and hold the learning certificate before starting" });
      continue;
    }
    const date = p.learningCertificateDate;
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Date.parse(date) > now.getTime() || Date.parse(date) > Date.parse(certificateDeadline || ""))) challengeIssues.push({ code: "certificate_date", participantId: p.id, message: "The learning certificate must have been issued by the certification deadline and cannot be dated in the future" });
    if (!date && now.getTime() > Date.parse(certificateDeadline || "") && (!options.challengeStartedAt || new Date(options.challengeStartedAt).getTime() > Date.parse(certificateDeadline || ""))) challengeIssues.push({ code: "certificate_date", participantId: p.id, message: "Record the learning certificate date to confirm it was held by the certification deadline" });
  }
  const sector = members[0]?.preference?.firstChoiceSector;
  const sectorSpecialistCount = members.filter(p => p.preference?.preferredRole === "sector_specialist" && sectorStudyMatch(p, sector)).length;
  const impactLeadCount = members.filter(p => p.preference?.preferredRole === "business_impact_lead").length;
  const femaleCount = members.filter(p => /^(female|woman|f)$/i.test((p.gender || "").trim())).length;
  const institutionCount = new Set(members.map(p => p.institution?.trim().toLowerCase()).filter(Boolean)).size;
  const guidance: string[] = [];
  if (members.length >= 4 && builderCount < 2) guidance.push("Aim for two builders in a team of 4 or 5");
  if (!sectorSpecialistCount) guidance.push("Add a sector specialist whose study background matches the preferred sector where possible");
  if (!impactLeadCount) guidance.push("Aim to include a user, business and impact lead");
  if (!femaleCount) guidance.push("Include at least one female member where possible");
  if (institutionCount < 2) guidance.push("Include members from more than one institution where possible");
  return { canRegister: !registrationIssues.length, canStartChallenge: !challengeIssues.length, registrationIssues, challengeIssues, guidance,
    builderCount, nonComputingCount, sectorSpecialistCount, impactLeadCount, femaleCount, institutionCount, countries,
    teamSize: members.length, joinDeadline, certificateDeadline,
    competitionCountries: options.hasBrief && problemCountry ? countries.filter(country => country.toLowerCase() === problemCountry.toLowerCase()) : countries };
}
