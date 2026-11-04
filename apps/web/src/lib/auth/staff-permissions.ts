import { hasStaffPermission, type StaffPermission } from "@acmp/shared";

/** Specific action pages must be checked before their broader read routes. */
export function staffPagePermission(pathname: string): StaffPermission {
  if (/^\/staff\/evaluations\/[^/]+\/score(?:\/|$)/.test(pathname)) return "review";
  if (pathname.startsWith("/staff/audit-logs")) return "audit";
  if (pathname.startsWith("/staff/matching") || pathname.startsWith("/staff/teams/removal-requests")) return "manage";
  if (/^\/staff\/(participants|partners|mentors)\/(new|import)(?:\/|$)/.test(pathname)) return "manage";
  if (/^\/staff\/cohorts\/new(?:\/|$)/.test(pathname)) return "manage";
  if (/^\/staff\/(briefs|cohorts|participants|partners|mentors)\/[^/]+\/edit(?:\/|$)/.test(pathname)) return "manage";
  return "read";
}

export function canAccessStaffPage(role: string | undefined, pathname: string): boolean {
  return hasStaffPermission(role, staffPagePermission(pathname));
}
