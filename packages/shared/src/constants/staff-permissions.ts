/** Staff capabilities shared by the portal and API. Data scope is checked separately. */
export const STAFF_ROLES = ["super_admin", "program_manager", "evaluator", "viewer"] as const;
export type StaffRole = typeof STAFF_ROLES[number];
export type StaffPermission = "read" | "manage" | "review" | "admin" | "audit" | "communicate";

export function hasStaffPermission(role: string | undefined, permission: StaffPermission): boolean {
  if (!role || !(STAFF_ROLES as readonly string[]).includes(role)) return false;
  if (permission === "read") return true;
  if (permission === "admin") return role === "super_admin";
  if (permission === "review" || permission === "communicate") return role !== "viewer";
  return role === "super_admin" || role === "program_manager";
}
