"use client";

import { useEffect, useState, useCallback } from "react";
import {
  initOneSignal,
  loginToOneSignal,
  logoutFromOneSignal,
  promptForPushPermission,
  hasPushPermission,
  isPushSubscribed,
  getPushSubscriptionId,
  optInToPush,
  optOutOfPush,
  isOneSignalConfigured,
  isPushSupported,
  getOneSignal,
} from "@/lib/onesignal";
import { useAuthStore } from "@/lib/stores/auth-store";

interface UsePushNotificationsReturn {
  /** Whether OneSignal is configured with an app ID */
  isConfigured: boolean;
  /** Whether push notifications are supported in this browser */
  isSupported: boolean;
  /** Whether OneSignal SDK is initialized */
  isInitialized: boolean;
  /** Whether the user has granted notification permission */
  hasPermission: boolean;
  /** Whether the user is subscribed to push notifications */
  isSubscribed: boolean;
  /** The OneSignal subscription ID (player ID) */
  subscriptionId: string | null;
  /** Show the push notification permission prompt */
  promptForPermission: () => Promise<void>;
  /** Subscribe to push notifications */
  subscribe: () => Promise<void>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>;
  /** Refresh the subscription state */
  refresh: () => void;
}

/**
 * Hook for managing push notification subscriptions with OneSignal
 *
 * Usage:
 * ```tsx
 * const { isSubscribed, promptForPermission, subscribe } = usePushNotifications();
 *
 * if (!isSubscribed) {
 *   return <Button onClick={promptForPermission}>Enable Notifications</Button>;
 * }
 * ```
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const { user, portal } = useAuthStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  const isConfigured = isOneSignalConfigured();
  const isSupported = isPushSupported();

  // Refresh subscription state
  const refresh = useCallback(() => {
    if (!isInitialized) return;

    setHasPermission(hasPushPermission());
    setIsSubscribed(isPushSubscribed());
    setSubscriptionId(getPushSubscriptionId());
  }, [isInitialized]);

  // Initialize OneSignal
  useEffect(() => {
    if (!isConfigured || !isSupported) return;

    let mounted = true;

    const init = async () => {
      try {
        await initOneSignal();
        if (mounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("Failed to initialize OneSignal:", error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [isConfigured, isSupported]);

  // Login to OneSignal when user is authenticated
  useEffect(() => {
    if (!isInitialized || !user || !portal) return;

    const login = async () => {
      try {
        // Map portal to user type for OneSignal
        const userType = portal === "staff" ? "user" : portal;
        await loginToOneSignal(user.id, userType as "participant" | "mentor" | "user");
        refresh();
      } catch (error) {
        console.error("Failed to login to OneSignal:", error);
      }
    };

    login();
  }, [isInitialized, user, portal, refresh]);

  // Logout from OneSignal when user logs out
  useEffect(() => {
    if (!isInitialized) return;
    if (user) return; // User is still logged in

    const logout = async () => {
      try {
        await logoutFromOneSignal();
        refresh();
      } catch (error) {
        console.error("Failed to logout from OneSignal:", error);
      }
    };

    logout();
  }, [isInitialized, user, refresh]);

  // Listen for permission and subscription changes
  useEffect(() => {
    if (!isInitialized) return;

    const oneSignal = getOneSignal();
    if (!oneSignal) return;

    // Initial state
    refresh();

    // Listen for permission changes
    const handlePermissionChange = () => {
      refresh();
    };

    // Listen for subscription changes
    const handleSubscriptionChange = () => {
      refresh();
    };

    oneSignal.Notifications.addEventListener(
      "permissionChange",
      handlePermissionChange
    );
    oneSignal.User.PushSubscription.addEventListener(
      "change",
      handleSubscriptionChange
    );

    return () => {
      oneSignal.Notifications.removeEventListener(
        "permissionChange",
        handlePermissionChange
      );
      oneSignal.User.PushSubscription.removeEventListener(
        "change",
        handleSubscriptionChange
      );
    };
  }, [isInitialized, refresh]);

  // Prompt for permission
  const promptForPermission = useCallback(async () => {
    if (!isInitialized) {
      console.warn("OneSignal not initialized");
      return;
    }

    await promptForPushPermission();
    refresh();
  }, [isInitialized, refresh]);

  // Subscribe to push
  const subscribe = useCallback(async () => {
    if (!isInitialized) {
      console.warn("OneSignal not initialized");
      return;
    }

    await optInToPush();
    refresh();
  }, [isInitialized, refresh]);

  // Unsubscribe from push
  const unsubscribe = useCallback(async () => {
    if (!isInitialized) {
      console.warn("OneSignal not initialized");
      return;
    }

    await optOutOfPush();
    refresh();
  }, [isInitialized, refresh]);

  return {
    isConfigured,
    isSupported,
    isInitialized,
    hasPermission,
    isSubscribed,
    subscriptionId,
    promptForPermission,
    subscribe,
    unsubscribe,
    refresh,
  };
}
