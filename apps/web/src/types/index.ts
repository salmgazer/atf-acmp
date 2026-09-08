/**
 * Common types used across the application
 */

// User roles
export type Role =
  | "super_admin"
  | "program_manager"
  | "evaluator"
  | "viewer"
  | "organization"
  | "participant"
  | "mentor";

// Portal types
export type Portal = "staff" | "organization" | "participant" | "mentor";

// Base user type
export interface User {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Cohort status
export type CohortStatus = "draft" | "active" | "evaluation" | "completed" | "archived";

// Team status
export type TeamStatus = "forming" | "active" | "submitted" | "evaluated" | "disqualified";

// Brief status
export type BriefStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "revision_requested";

// Team role
export type TeamRole = "lead" | "co_lead" | "member";

// Pagination params
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

// Pagination meta
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
