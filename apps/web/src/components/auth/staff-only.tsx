"use client";

import type { ReactNode } from "react";
import { hasStaffPermission, type StaffPermission } from "@acmp/shared";
import { useAuthStore } from "@/lib/stores/auth-store";

export function useStaffPermission(permission: StaffPermission): boolean {
  return hasStaffPermission(useAuthStore(state => state.user?.role), permission);
}

/** Presentation only: API authorization independently enforces every action. */
export function StaffOnly({ permission, children }: { permission: StaffPermission; children: ReactNode }) {
  return useStaffPermission(permission) ? <>{children}</> : null;
}
