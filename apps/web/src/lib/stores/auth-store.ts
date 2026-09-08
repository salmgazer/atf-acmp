import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Role =
  | "super_admin"
  | "program_manager"
  | "evaluator"
  | "viewer"
  | "organization"
  | "participant"
  | "mentor";

export type Portal = "staff" | "organization" | "participant" | "mentor";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  mustChangePassword?: boolean;
  onboardingComplete?: boolean;
  participantId?: string;
  participant?: {
    id: string;
    participantId: string;
    cohortId?: string;
  };
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  portal: Portal | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setPortal: (portal: Portal | null) => void;
  login: (user: AuthUser, token: string, portal: Portal) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      portal: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setToken: (token) => {
        set({ token });
        if (typeof window !== "undefined") {
          if (token) {
            localStorage.setItem("auth_token", token);
            // Also set cookie for middleware
            document.cookie = `auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
          } else {
            localStorage.removeItem("auth_token");
            document.cookie = "auth_token=; path=/; max-age=0";
          }
        }
      },

      setLoading: (isLoading) => set({ isLoading }),

      setPortal: (portal) => set({ portal }),

      login: (user, token, portal) => {
        set({
          user,
          token,
          portal,
          isAuthenticated: true,
          isLoading: false,
        });
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", token);
          document.cookie = `auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          portal: null,
          isAuthenticated: false,
          isLoading: false,
        });
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          document.cookie = "auth_token=; path=/; max-age=0";
        }
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },
    }),
    {
      name: "acmp-auth-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        portal: state.portal,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Set loading to false after hydration completes
        if (state) {
          state.setLoading(false);
        }
      },
    }
  )
);

// Helper to get portal from role
export function getPortalFromRole(role: Role): Portal {
  switch (role) {
    case "super_admin":
    case "program_manager":
    case "evaluator":
    case "viewer":
      return "staff";
    case "organization":
      return "organization";
    case "participant":
      return "participant";
    case "mentor":
      return "mentor";
    default:
      return "participant";
  }
}

// Helper to check if role has access to portal
export function canAccessPortal(role: Role, portal: Portal): boolean {
  const allowedPortal = getPortalFromRole(role);
  return allowedPortal === portal;
}

// Helper to get login path for portal
export function getLoginPath(portal: Portal): string {
  switch (portal) {
    case "staff":
      return "/portal/login";
    case "organization":
      return "/org/login";
    case "participant":
      return "/app/login";
    case "mentor":
      return "/mentor/login";
    default:
      return "/";
  }
}

// Helper to get dashboard path for portal
export function getDashboardPath(portal: Portal): string {
  switch (portal) {
    case "staff":
      return "/portal/dashboard";
    case "organization":
      return "/org/dashboard";
    case "participant":
      return "/app/dashboard";
    case "mentor":
      return "/mentor/dashboard";
    default:
      return "/";
  }
}
