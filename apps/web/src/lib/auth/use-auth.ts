"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, canAccessPortal, getLoginPath, getDashboardPath, type Portal, type Role } from "@/lib/stores/auth-store";
import { signOut } from "@/lib/auth";
import { api } from "@/lib/api/client";

interface UseAuthOptions {
  portal: Portal;
  redirectIfUnauthenticated?: boolean;
  redirectIfAuthenticated?: boolean;
}

/**
 * Hook for managing authentication state within a portal
 */
export function useAuth(options?: UseAuthOptions) {
  const router = useRouter();
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    portal: currentPortal,
    logout: storeLogout,
    setLoading,
  } = useAuthStore();

  const portal = options?.portal || currentPortal;
  const redirectIfUnauthenticated = options?.redirectIfUnauthenticated ?? true;
  const redirectIfAuthenticated = options?.redirectIfAuthenticated ?? false;

  // Verify token and user access on mount
  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setLoading(false);
        if (redirectIfUnauthenticated && portal) {
          router.push(getLoginPath(portal));
        }
        return;
      }

      try {
        // Verify token with backend
        const response = await api.get("/auth/me");
        const userData = response.data;

        // Check portal access
        if (portal && !canAccessPortal(userData.role, portal)) {
          storeLogout();
          router.push(getLoginPath(portal));
          return;
        }

        // If authenticated and on login page, redirect to dashboard
        if (redirectIfAuthenticated && portal) {
          router.push(getDashboardPath(portal));
        }
      } catch (error) {
        // Token invalid, clear auth state
        storeLogout();
        if (redirectIfUnauthenticated && portal) {
          router.push(getLoginPath(portal));
        }
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, [token, portal, redirectIfUnauthenticated, redirectIfAuthenticated, router, storeLogout, setLoading]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      storeLogout();
      if (portal) {
        router.push(getLoginPath(portal));
      }
    }
  }, [portal, router, storeLogout]);

  // Check if user has required role
  const hasRole = useCallback(
    (roles: Role | Role[]) => {
      if (!user) return false;
      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(user.role);
    },
    [user]
  );

  // Check if user can access a specific portal
  const canAccess = useCallback(
    (targetPortal: Portal) => {
      if (!user) return false;
      return canAccessPortal(user.role, targetPortal);
    },
    [user]
  );

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    portal: currentPortal,
    logout: handleLogout,
    hasRole,
    canAccess,
  };
}

/**
 * Hook specifically for login pages
 */
export function useLoginPage(portal: Portal) {
  return useAuth({
    portal,
    redirectIfUnauthenticated: false,
    redirectIfAuthenticated: true,
  });
}

/**
 * Hook for protected pages
 */
export function useProtectedPage(portal: Portal) {
  return useAuth({
    portal,
    redirectIfUnauthenticated: true,
    redirectIfAuthenticated: false,
  });
}
