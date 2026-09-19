"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  initOneSignal,
  loginToOneSignal,
  logoutFromOneSignal,
  isOneSignalConfigured,
  getOneSignal,
} from "@/lib/onesignal";

/**
 * Component that manages OneSignal push notification registration
 * based on user authentication state.
 * 
 * This component should be rendered once at the app root level.
 * It handles:
 * - Initializing OneSignal SDK
 * - Logging in the user to OneSignal when authenticated (sets external_user_id)
 * - Logging out from OneSignal when user logs out
 */
export function PushNotificationManager() {
  const { user, portal, isAuthenticated } = useAuthStore();
  const hasLoggedIn = useRef(false);
  const lastUserId = useRef<string | null>(null);

  // Initialize OneSignal and handle user login/logout
  useEffect(() => {
    if (!isOneSignalConfigured()) {
      return;
    }

    const setupOneSignal = async () => {
      try {
        // Wait for OneSignal to be ready
        await initOneSignal();

        const oneSignal = getOneSignal();
        if (!oneSignal) {
          console.debug("OneSignal not available");
          return;
        }

        if (isAuthenticated && user && portal) {
          // User is logged in - register with OneSignal
          if (!hasLoggedIn.current || lastUserId.current !== user.id) {
            const userType = portal === "staff" ? "user" : portal;
            console.log(`🔔 OneSignal: Logging in user ${userType}:${user.id}`);
            
            await loginToOneSignal(user.id, userType as "participant" | "mentor" | "user");
            
            hasLoggedIn.current = true;
            lastUserId.current = user.id;
            
            console.log("🔔 OneSignal: User registered for push notifications");
          }
        } else if (hasLoggedIn.current) {
          // User logged out - unregister from OneSignal
          console.log("🔔 OneSignal: Logging out user");
          await logoutFromOneSignal();
          hasLoggedIn.current = false;
          lastUserId.current = null;
        }
      } catch (error) {
        // Silently handle errors (e.g., ad blocker blocking OneSignal)
        console.debug("OneSignal setup error:", error);
      }
    };

    setupOneSignal();
  }, [isAuthenticated, user, portal]);

  // This component doesn't render anything
  return null;
}
