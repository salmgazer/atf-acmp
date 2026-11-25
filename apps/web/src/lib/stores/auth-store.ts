import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AUTH_STORAGE_KEY, AUTH_STORAGE_VERSION, authSessionStorage, clearBrowserAuth, removeAuthItem, saveBrowserLogin, writeAuthCookie, writeAuthItem } from "./auth-session-storage";

export type Role =
  | "super_admin"
  | "program_manager"
  | "evaluator"
  | "viewer"
  | "organization"
  | "participant"
  | "mentor";

export type Portal = "staff" | "partner" | "participant" | "mentor";

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
            writeAuthItem("auth_token", token);
            // Also set cookie for middleware
            writeAuthCookie(`auth_token=present; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`);
          } else {
            removeAuthItem("auth_token");
            writeAuthCookie("auth_token=; path=/; max-age=0");
          }
        }
      },

      setLoading: (isLoading) => set({ isLoading }),

      setPortal: (portal) => set({ portal }),

      login: (user, token, portal) => {
        saveBrowserLogin({ user, token, portal, isAuthenticated: true });
        set({
          user,
          token,
          portal,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          portal: null,
          isAuthenticated: false,
          isLoading: false,
        });
        clearBrowserAuth();
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: AUTH_STORAGE_VERSION,
      storage: createJSONStorage(() => authSessionStorage),
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
          // Ensure portal cookie is set after hydration (for existing sessions)
          if (typeof window !== "undefined" && state.portal && state.token) {
            writeAuthCookie(`auth_portal=${state.portal}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`);
          }
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
      return "partner";
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
      return "/staff/login";
    case "partner":
      return "/partners/login";
    case "participant":
      return "/participant/login";
    case "mentor":
      return "/mentor/login";
    default:
      return "/";
  }
}

/** Allow local return paths within the authenticated portal only. */
export function safeReturnPath(value: string | null | undefined, portal: Portal): string {
  const fallback = getDashboardPath(portal);
  const base = fallback.slice(0, fallback.lastIndexOf("/"));
  if (!value || /[\\\s]/.test(value)) return fallback;
  try { const url = new URL(value, "https://local.invalid"); return url.origin === "https://local.invalid" && (url.pathname === base || url.pathname.startsWith(base + "/")) ? url.pathname + url.search + url.hash : fallback; } catch { return fallback; }
}

// Helper to get dashboard path for portal
export function getDashboardPath(portal: Portal): string {
  switch (portal) {
    case "staff":
      return "/staff/dashboard";
    case "partner":
      return "/partners/dashboard";
    case "participant":
      return "/participant/dashboard";
    case "mentor":
      return "/mentor/dashboard";
    default:
      return "/";
  }
}
