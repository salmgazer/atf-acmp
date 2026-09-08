// Countries supported in ATF AI Challenge
export const SUPPORTED_COUNTRIES = ["GH", "NG", "KE", "ZA"] as const;

export const COUNTRY_NAMES: Record<string, string> = {
  GH: "Ghana",
  NG: "Nigeria",
  KE: "Kenya",
  ZA: "South Africa",
};

// Verticals/Industries
export const VERTICALS = ["healthcare", "agriculture", "finance", "education"] as const;

export const VERTICAL_NAMES: Record<string, string> = {
  healthcare: "Healthcare",
  agriculture: "Agriculture",
  finance: "Finance",
  education: "Education",
};

// Team constraints
export const TEAM_SIZE_MIN = 3;
export const TEAM_SIZE_MAX = 5;

// Stage names
export const STAGES = {
  REGISTRATION: "registration",
  TEAM_FORMATION: "team_formation",
  STAGE_1: "stage_1",
  STAGE_2: "stage_2",
  STAGE_3: "stage_3",
  DEMO_DAY: "demo_day",
} as const;

// Status colors for UI
export const STATUS_COLORS = {
  draft: { bg: "bg-gray-100", text: "text-gray-700" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-700" },
  active: { bg: "bg-green-100", text: "text-green-700" },
  completed: { bg: "bg-blue-100", text: "text-blue-700" },
  rejected: { bg: "bg-red-100", text: "text-red-700" },
} as const;
