import type { StateStorage } from "zustand/middleware";

export const AUTH_STORAGE_KEY = "acmp-auth-store";
export const AUTH_STORAGE_VERSION = 0;
const portals = ["staff", "participant", "partner", "mentor"];
const roles = ["super_admin", "program_manager", "evaluator", "viewer", "participant", "organization", "mentor"];

export function readAuthItem(key: string): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); }
  catch { return null; }
}

export function writeAuthItem(key: string, value: string): boolean {
  try { window.localStorage.setItem(key, value); return true; }
  catch { return false; }
}

export function removeAuthItem(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* Storage can be blocked by browser settings. */ }
}

export function writeAuthCookie(value: string): void {
  try { document.cookie = value; } catch { /* A blocked cookie must not prevent local recovery. */ }
}

export function clearBrowserAuth(): void {
  for (const key of [AUTH_STORAGE_KEY, "auth_token", "refresh_token"]) removeAuthItem(key);
  writeAuthCookie("auth_token=; path=/; max-age=0");
  writeAuthCookie("auth_portal=; path=/; max-age=0");
}

/** Invalid browser data is discarded; it never grants access or holds hydration open. */
export const authSessionStorage: StateStorage = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    const raw = readAuthItem(key);
    try {
      const saved = raw ? JSON.parse(raw) : null;
      const state = saved?.state;
      if (!state || state.isAuthenticated !== true || typeof state.token !== "string" || !state.token ||
        typeof state.user?.id !== "string" || !state.user.id || typeof state.user?.email !== "string" ||
        !roles.includes(state.user.role) || !portals.includes(state.portal)) {
        clearBrowserAuth();
        return null;
      }
      // Older sessions can lack the separate request-header token. Restore it from
      // the saved session; the API still verifies it before protected content renders.
      if (!readAuthItem("auth_token") && !writeAuthItem("auth_token", state.token)) {
        clearBrowserAuth(); return null;
      }
      return raw;
    } catch {
      clearBrowserAuth(); return null;
    }
  },
  setItem(key, value) { writeAuthItem(key, value); },
  removeItem(key) { removeAuthItem(key); },
};

/** Check browser persistence before marking a new login authenticated. */
export function saveBrowserLogin(state: { user: unknown; token: string; portal: string; isAuthenticated: boolean }): void {
  if (typeof window === "undefined") return;
  const failure = "Your browser could not save your session. Allow cookies and site storage, then try again.";
  if (!writeAuthItem("auth_token", state.token) ||
    !writeAuthItem(AUTH_STORAGE_KEY, JSON.stringify({ state, version: AUTH_STORAGE_VERSION }))) {
    clearBrowserAuth(); throw new Error(failure);
  }
  writeAuthCookie("auth_token=present; path=/; max-age=604800; samesite=lax");
  writeAuthCookie(`auth_portal=${state.portal}; path=/; max-age=604800; samesite=lax`);
  try {
    const cookies = document.cookie.split(";").map(value => value.trim());
    if (!cookies.includes("auth_token=present") || !cookies.includes(`auth_portal=${state.portal}`)) throw new Error(failure);
  } catch {
    clearBrowserAuth(); throw new Error(failure);
  }
  removeAuthItem("refresh_token");
}
