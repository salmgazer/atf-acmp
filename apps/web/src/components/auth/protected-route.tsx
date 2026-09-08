"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, canAccessPortal, getLoginPath, type Portal, type Role } from "@/lib/stores/auth-store";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  portal: Portal;
  roles?: Role[];
  fallback?: React.ReactNode;
}

/**
 * Component wrapper for protecting routes
 */
export function ProtectedRoute({
  children,
  portal,
  roles,
  fallback,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated
    if (!isAuthenticated || !user) {
      router.push(getLoginPath(portal));
      return;
    }

    // Check portal access
    if (!canAccessPortal(user.role, portal)) {
      router.push(getLoginPath(portal));
      return;
    }

    // Check role requirements
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      router.push(getLoginPath(portal));
    }
  }, [isAuthenticated, isLoading, user, portal, roles, router]);

  // Loading state
  if (isLoading) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    );
  }

  // Not authenticated or no access
  if (!isAuthenticated || !user || !canAccessPortal(user.role, portal)) {
    return null;
  }

  // Check role requirements
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Component wrapper for routes that should only be shown to guests
 */
interface GuestRouteProps {
  children: React.ReactNode;
  portal: Portal;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export function GuestRoute({
  children,
  portal,
  redirectTo,
  fallback,
}: GuestRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user && canAccessPortal(user.role, portal)) {
      setIsRedirecting(true);
      
      // Check for returnTo in URL search params
      const searchParams = new URLSearchParams(window.location.search);
      const returnTo = searchParams.get("returnTo");
      
      const dashboardPath =
        returnTo ||
        redirectTo ||
        `/${
          portal === "staff"
            ? "portal"
            : portal === "organization"
            ? "org"
            : portal === "participant"
            ? "app"
            : "mentor"
        }/dashboard`;
      router.push(dashboardPath);
    }
  }, [isAuthenticated, isLoading, user, portal, redirectTo, router]);

  // Loading state or redirecting - show spinner
  if (isLoading || isRedirecting) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    );
  }

  // If authenticated with portal access, show loading while redirect effect triggers
  if (isAuthenticated && user && canAccessPortal(user.role, portal)) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    );
  }

  return <>{children}</>;
}
