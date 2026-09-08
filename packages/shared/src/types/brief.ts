export type BriefStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "revision_requested";

export interface BriefResource {
  name: string;
  url: string;
  type: string;
}

export interface Brief {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  expectedOutcomes: string;
  vertical: string;
  status: BriefStatus;
  cohortId: string;
  organizationId: string;
  teamsCount: number;
  maxTeams: number;
  tags: string[];
  resources?: BriefResource[];
  reviewFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BriefWithOrganization extends Brief {
  organization: {
    id: string;
    name: string;
    logoUrl?: string;
  };
}
