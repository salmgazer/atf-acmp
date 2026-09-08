"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import {
  useAuthStore,
  getPortalFromRole,
  getLoginPath,
  getDashboardPath,
  canAccessPortal,
  type AuthUser,
  type Portal,
} from "@/lib/stores/auth-store";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  portal: Portal | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  portal: null,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, portal, setUser, setToken, setLoading, setPortal, logout } =
    useAuthStore();

  // Determine current portal from pathname
  const getCurrentPortal = (): Portal | null => {
    if (pathname.startsWith("/portal")) return "staff";
    if (pathname.startsWith("/org")) return "organization";
    if (pathname.startsWith("/app")) return "participant";
    if (pathname.startsWith("/mentor")) return "mentor";
    return null;
  };

  useEffect(() => {
    // Check if we have a stored token and verify it's still valid
    const verifyAuth = async () => {
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      
      if (storedToken) {
        try {
          // Verify token by calling /auth/me endpoint
          const response = await apiClient.get<{ id: string; email: string; role: string }>("/auth/me");
          
          // Token is valid, user data is already in store from zustand persist
          // Just verify the user matches
          if (response.data && response.data.id) {
            setLoading(false);
            return;
          }
        } catch (error) {
          // Token is invalid, clear it
          console.error("Token verification failed:", error);
          logout();
        }
      }
      
      setLoading(false);
    };

    verifyAuth();
  }, []);

  // Handle route protection
  useEffect(() => {
    if (isLoading) return;

    const currentPortal = getCurrentPortal();
    const isLoginPage = pathname.includes("/login");
    const isSetupPage = pathname.includes("/setup");
    const isPublicPage = pathname === "/" || isLoginPage || isSetupPage;

    if (!isAuthenticated && currentPortal && !isLoginPage && !isSetupPage) {
      // Not authenticated, redirect to portal login
      router.replace(getLoginPath(currentPortal));
      return;
    }

    if (isAuthenticated && user && currentPortal) {
      // Check if user can access current portal
      if (!canAccessPortal(user.role, currentPortal)) {
        // Redirect to correct portal
        router.replace(getDashboardPath(getPortalFromRole(user.role)));
        return;
      }

      // Check if user needs to change password
      if (user.mustChangePassword && !pathname.includes("/change-password")) {
        const portalPath = currentPortal === "participant" ? "app" : 
                          currentPortal === "organization" ? "org" : currentPortal;
        router.replace(`/${portalPath}/change-password`);
        return;
      }

      // Redirect from login to dashboard if already authenticated
      if (isLoginPage) {
        router.replace(getDashboardPath(currentPortal));
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, portal }}>
      {children}
    </AuthContext.Provider>
  );
}
