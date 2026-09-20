// Types for the onboarding form
// Re-export scoring types from shared package
export type { ScoringResult, BriefFitBand, BriefImpactBand } from "@acmp/shared";
import type { ScoringAnswers } from "@acmp/shared";
export type { ScoringAnswers };

export const VALID_COUNTRIES = ["Ghana", "Nigeria", "Kenya", "South Africa"] as const;
export type ValidCountry = (typeof VALID_COUNTRIES)[number];

export const SECTORS = [
  "Healthcare",
  "Agriculture",
  "Finance",
  "Local/Municipal Government",
  "Education",
  "Legal services",
  "Retail/SME",
  "Logistics",
  "Manufacturing",
  "Other",
] as const;

// Scoring question options
export const Q1_OPTIONS = [
  { value: "routine", label: "It's routine work—the same steps every time" },
  { value: "judgement", label: "It requires judgement—weighing options and making calls" },
  { value: "sense_making", label: "It's sense-making—spotting patterns in messy information" },
  { value: "no_system", label: "There's no system in place yet" },
  { value: "new_capability", label: "It's something we can't do at all today" },
] as const;

export const Q2_OPTIONS = [
  { value: "good_records", label: "We have good digital records" },
  { value: "partial", label: "We have partial or paper-based records" },
  { value: "very_little", label: "We have very little data" },
] as const;

export const Q3_OPTIONS = [
  { value: "straightforward", label: "Straightforward—clear rules exist" },
  { value: "mixed", label: "Mixed—some rules, some grey areas" },
  { value: "hard", label: "Hard—often unclear or context-dependent" },
] as const;

export const Q4_OPTIONS = [
  { value: "yes", label: "Yes, we can tell good from bad outcomes" },
  { value: "no_exact", label: "Not exactly—quality is subjective" },
] as const;

export const Q5_OPTIONS = [
  { value: "clear", label: "Clear and measurable" },
  { value: "vague", label: "Vague or hard to pin down" },
] as const;

export const Q6_OPTIONS = [
  { value: "very_often", label: "Very often (daily or weekly)" },
  { value: "now_and_then", label: "Now and then (monthly or less)" },
] as const;

export const Q7_OPTIONS = [
  { value: "convenient", label: "Convenient—saves time or effort" },
  { value: "meaningful", label: "Meaningful—noticeably improves quality of life" },
  { value: "transformative", label: "Transformative—life-changing impact" },
] as const;

export const Q8_OPTIONS = [
  { value: "local", label: "Local—a community or district" },
  { value: "thousands", label: "Thousands—a city or region" },
  { value: "national", label: "National or beyond" },
] as const;

export interface SecondaryContact {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface Opportunity {
  title: string;
  description: string;
  whatChanges: string;
  howMany: string;
  dataDescription: string;
  dataAccess: string;
  secondaryContact?: SecondaryContact;
  scoringAnswers: ScoringAnswers;
}

export interface OrganizationInfo {
  orgName: string;
  sector: string;
  sectorOther?: string;
  country: ValidCountry | "";
  city: string;
  contactName: string;
  designation: string;
  department?: string;
  email: string;
  phone: string;
}

export interface FormState {
  sessionId: string;
  org: OrganizationInfo;
  opportunities: Opportunity[];
  consentGiven: boolean;
}

// Initial empty opportunity
export const createEmptyOpportunity = (): Opportunity => ({
  title: "",
  description: "",
  whatChanges: "",
  howMany: "",
  dataDescription: "",
  dataAccess: "",
  secondaryContact: {
    name: "",
    role: "",
    email: "",
    phone: "",
  },
  scoringAnswers: {
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
    q8: "",
  },
});

// Initial form state
export const createInitialFormState = (): FormState => ({
  sessionId: crypto.randomUUID(),
  org: {
    orgName: "",
    sector: "",
    sectorOther: "",
    country: "",
    city: "",
    contactName: "",
    designation: "",
    department: "",
    email: "",
    phone: "",
  },
  opportunities: [createEmptyOpportunity()],
  consentGiven: false,
});
