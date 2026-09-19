import { apiClient } from "@/lib/api/client";
import { useAuthStore, type AuthUser, type Portal } from "@/lib/stores/auth-store";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string,
  portal: Portal
): Promise<{ user: AuthUser; token: string }> {
  const response = await apiClient.post<LoginResponse>("/auth/login", {
    email,
    password,
    portal,
  });

  const { accessToken, refreshToken, user } = response.data;

  // Store refresh token for later use
  if (typeof window !== "undefined") {
    console.log("[signInWithEmail] Storing refresh token:", !!refreshToken);
    if (refreshToken) {
      localStorage.setItem("refresh_token", refreshToken);
    } else {
      console.warn("[signInWithEmail] No refresh token in response!");
    }
  }

  return { user, token: accessToken };
}

/**
 * Sign out and clear local state
 */
export async function signOut(): Promise<void> {
  try {
    const refreshToken = typeof window !== "undefined" 
      ? localStorage.getItem("refresh_token") 
      : null;
    
    if (refreshToken) {
      await apiClient.post("/auth/logout", { refreshToken });
    }
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("refresh_token");
    }
    useAuthStore.getState().logout();
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = typeof window !== "undefined" 
    ? localStorage.getItem("refresh_token") 
    : null;

  if (!refreshToken) return null;

  try {
    const response = await apiClient.post<LoginResponse>("/auth/refresh", {
      refreshToken,
    });

    const { accessToken, user } = response.data;

    // Update store with new token and user
    useAuthStore.getState().setToken(accessToken);
    useAuthStore.getState().setUser(user);

    return accessToken;
  } catch (error) {
    // Refresh failed, logout
    signOut();
    return null;
  }
}

/**
 * Change password for current user
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiClient.post("/auth/change-password", {
    currentPassword,
    newPassword,
  });

  // Update local state
  useAuthStore.getState().updateUser({ mustChangePassword: false });
}

/**
 * Request magic link code (for organizations/mentors)
 */
export async function requestMagicLink(email: string, portal: Portal): Promise<void> {
  await apiClient.post("/auth/magic-link", { email, portal });
}

/**
 * Verify magic link code
 */
export async function verifyMagicCode(
  email: string,
  code: string
): Promise<{ user: AuthUser; token: string }> {
  const response = await apiClient.post<LoginResponse>("/auth/verify-code", {
    email,
    code,
  });

  const { accessToken, refreshToken, user } = response.data;

  // Store refresh token
  if (typeof window !== "undefined") {
    localStorage.setItem("refresh_token", refreshToken);
  }

  return { user, token: accessToken };
}
