export type CohortStatus = "draft" | "active" | "evaluation" | "completed" | "archived";

export interface CohortDeadlines {
  teamFormationEnd: string;
  briefSelectionEnd: string;
  stage1End: string;
  stage2End: string;
  stage3End: string;
  demoDay: string;
}

export interface RubricCriteria {
  name: string;
  weight: number;
  description: string;
}

export interface RubricConfig {
  criteria: RubricCriteria[];
}

export interface Cohort {
  id: string;
  name: string;
  description?: string;
  status: CohortStatus;
  teamSizeMin: number;
  teamSizeMax: number;
  deadlines: CohortDeadlines;
  rubric?: RubricConfig;
  countries: string[];
  verticals: string[];
  briefCap: number;
  maxTeamsPerBrief: number;
  createdAt: string;
  updatedAt: string;
}
