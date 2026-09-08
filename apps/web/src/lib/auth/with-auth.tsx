"use client";

import { useEffect, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, canAccessPortal, getLoginPath, type Portal, type Role } from "@/lib/stores/auth-store";

interface WithAuthOptions {
  portal: Portal;
  roles?: Role[];
  redirectTo?: string;
}

/**
 * HOC for protecting pages that require authentication
 */
export function withAuth<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithAuthOptions
) {
  const { portal, roles, redirectTo } = options;

  return function WithAuthComponent(props: P) {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuthStore();

    useEffect(() => {
      if (isLoading) return;

      // Not authenticated, redirect to login
      if (!isAuthenticated || !user) {
        const loginPath = redirectTo || getLoginPath(portal);
        router.push(loginPath);
        return;
      }

      // Check portal access
      if (!canAccessPortal(user.role, portal)) {
        router.push(getLoginPath(portal));
        return;
      }

      // Check role requirements
      if (roles && roles.length > 0 && !roles.includes(user.role)) {
        // User doesn't have required role, redirect to their dashboard
        router.push(getLoginPath(portal));
      }
    }, [isAuthenticated, isLoading, user, router]);

    // Show nothing while loading or redirecting
    if (isLoading || !isAuthenticated || !user) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }

    // Check portal access
    if (!canAccessPortal(user.role, portal)) {
      return null;
    }

    // Check role requirements
    if (roles && roles.length > 0 && !roles.includes(user.role)) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * HOC for pages that should only be shown to unauthenticated users (login pages)
 */
export function withGuest<P extends object>(
  WrappedComponent: ComponentType<P>,
  portal: Portal,
  redirectTo?: string
) {
  return function WithGuestComponent(props: P) {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useAuthStore();

    useEffect(() => {
      if (isLoading) return;

      if (isAuthenticated && user) {
        // Check if user can access this portal
        if (canAccessPortal(user.role, portal)) {
          const dashboardPath = redirectTo || `/${portal === "staff" ? "portal" : portal === "organization" ? "org" : portal === "participant" ? "app" : "mentor"}/dashboard`;
          router.push(dashboardPath);
        }
      }
    }, [isAuthenticated, isLoading, user, router]);

    // Show loading while checking auth
    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }

    // If authenticated, show nothing while redirecting
    if (isAuthenticated && user && canAccessPortal(user.role, portal)) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}
