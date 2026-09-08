export type Role =
  | "super_admin"
  | "program_manager"
  | "evaluator"
  | "viewer"
  | "organization"
  | "participant"
  | "mentor";

export type Portal = "staff" | "organization" | "participant" | "mentor";

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
