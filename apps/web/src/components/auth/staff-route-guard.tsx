"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuthStore, getDashboardPath, getPortalFromRole, type AuthUser } from "@/lib/stores/auth-store";
import { canAccessStaffPage } from "@/lib/auth/staff-permissions";
import { StaffLayout } from "@/components/layouts/staff-layout";
import { Button } from "@/components/ui/button";

const publicPaths = ["/staff/login", "/staff/forgot-password", "/staff/reset-password", "/staff/setup"];

export function StaffRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { user, token, updateUser, setUser } = useAuthStore();
  const isPublic = publicPaths.includes(pathname);
  const { data: principal, isPending, isError, refetch } = useQuery({
    queryKey: ["staff-principal", token],
    queryFn: () => api.get<AuthUser>("/auth/me"),
    enabled: mounted && !!token && !isPublic,
    refetchInterval: 60_000,
    retry: false,
  });

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !token && !isPublic) router.replace(`/staff/login?returnTo=${encodeURIComponent(pathname)}`);
  }, [mounted, token, isPublic, pathname, router]);
  useEffect(() => {
    if (!principal) return;
    // Refresh persisted permissions from the server, including mid-session role changes.
    if (useAuthStore.getState().user) updateUser(principal);
    else setUser(principal);
    if (getPortalFromRole(principal.role) !== "staff") router.replace(getDashboardPath(getPortalFromRole(principal.role)));
  }, [principal, updateUser, setUser, router]);

  if (isPublic) return children;
  if (!mounted || !token || isPending) return <div role="status" className="p-8">Loading your account…</div>;
  if (isError) return <div className="space-y-4 p-8"><p>Unable to verify your access.</p><Button onClick={() => refetch()}>Try again</Button><Link className="block underline" href="/staff/login">Back to login</Link></div>;
  if (!principal || getPortalFromRole(principal.role) !== "staff") return null;
  if (!user || user.id !== principal.id || user.role !== principal.role) return <div role="status" className="p-8">Updating your access…</div>;
  if (!canAccessStaffPage(principal.role, pathname)) {
    return <StaffLayout><div className="space-y-4 p-6"><h1 className="text-2xl font-semibold">Access restricted</h1><p>Your staff role does not allow this action.</p><Button asChild><Link href="/staff/dashboard">Go to dashboard</Link></Button></div></StaffLayout>;
  }
  return children;
}
