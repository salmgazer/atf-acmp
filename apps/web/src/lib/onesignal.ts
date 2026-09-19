/**
 * OneSignal Web Push Notification Integration
 *
 * This module initializes OneSignal and provides utilities for
 * managing push notification subscriptions.
 */

// OneSignal types
declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalInstance) => void>;
    OneSignal?: OneSignalInstance;
  }
}

interface OneSignalInstance {
  init: (options: OneSignalInitOptions) => Promise<void>;
  Slidedown: {
    promptPush: (options?: { force?: boolean }) => Promise<void>;
  };
  Notifications: {
    permission: boolean;
    permissionNative: NotificationPermission;
    isPushSupported: () => boolean;
    requestPermission: () => Promise<void>;
    addEventListener: (
      event: "permissionChange" | "click",
      callback: (data: any) => void
    ) => void;
    removeEventListener: (
      event: "permissionChange" | "click",
      callback: (data: any) => void
    ) => void;
  };
  User: {
    PushSubscription: {
      id: string | null | undefined;
      token: string | null | undefined;
      optedIn: boolean;
      addEventListener: (event: "change", callback: (data: any) => void) => void;
      removeEventListener: (event: "change", callback: (data: any) => void) => void;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
    };
    addAlias: (label: string, id: string) => void;
    addAliases: (aliases: Record<string, string>) => void;
    removeAlias: (label: string) => void;
    addTag: (key: string, value: string) => void;
    addTags: (tags: Record<string, string>) => void;
    removeTag: (key: string) => void;
    removeTags: (keys: string[]) => void;
  };
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface OneSignalInitOptions {
  appId: string;
  safari_web_id?: string;
  notifyButton?: {
    enable: boolean;
  };
  allowLocalhostAsSecureOrigin?: boolean;
  serviceWorkerParam?: {
    scope: string;
  };
  serviceWorkerPath?: string;
  promptOptions?: {
    slidedown?: {
      prompts: Array<{
        type: "push";
        autoPrompt: boolean;
        text: {
          actionMessage: string;
          acceptButton: string;
          cancelButton: string;
        };
        delay: {
          pageViews: number;
          timeDelay: number;
        };
      }>;
    };
  };
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Check if OneSignal is configured
 */
export function isOneSignalConfigured(): boolean {
  return !!ONESIGNAL_APP_ID;
}

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;

  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Initialize OneSignal SDK
 * Note: SDK is loaded via Script tag in layout.tsx
 * This function waits for the SDK to be fully initialized (not just loaded)
 */
export async function initOneSignal(): Promise<void> {
  // Return early if not in browser or not configured
  if (typeof window === "undefined") return;
  if (!isOneSignalConfigured()) {
    console.warn("OneSignal: App ID not configured");
    return;
  }

  // Return if already initialized
  if (isInitialized) return;

  // Return existing promise if already initializing
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    // Use OneSignalDeferred to ensure init() has completed
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        // At this point, OneSignal.init() has already been called in layout.tsx
        // and the SDK is fully ready for use
        isInitialized = true;
        console.log("OneSignal: SDK ready");
        resolve();
      } catch (error) {
        console.error("OneSignal: Initialization error", error);
        reject(error);
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!isInitialized) {
        console.warn("OneSignal: SDK initialization timeout");
        resolve(); // Resolve anyway to not block the app
      }
    }, 10000);
  });

  return initPromise;
}

/**
 * Get the OneSignal instance
 */
export function getOneSignal(): OneSignalInstance | null {
  if (typeof window === "undefined") return null;
  return window.OneSignal || null;
}

/**
 * Login user to OneSignal (sets external user ID)
 * Call this after user authentication
 */
export async function loginToOneSignal(
  userId: string,
  userType: "participant" | "mentor" | "user"
): Promise<void> {
  const oneSignal = getOneSignal();
  if (!oneSignal) {
    console.warn("OneSignal: Not initialized");
    return;
  }

  try {
    // Set the external user ID in format: userType:userId
    const externalId = `${userType}:${userId}`;
    await oneSignal.login(externalId);

    // Add tags for segmentation
    oneSignal.User.addTags({
      user_type: userType,
      user_id: userId,
    });

    console.log("OneSignal: User logged in", externalId);
  } catch (error) {
    console.error("OneSignal: Login error", error);
  }
}

/**
 * Logout user from OneSignal
 * Call this when user logs out
 */
export async function logoutFromOneSignal(): Promise<void> {
  const oneSignal = getOneSignal();
  if (!oneSignal) return;

  try {
    await oneSignal.logout();
    console.log("OneSignal: User logged out");
  } catch (error) {
    console.error("OneSignal: Logout error", error);
  }
}

/**
 * Prompt user to subscribe to push notifications
 */
export async function promptForPushPermission(): Promise<void> {
  const oneSignal = getOneSignal();
  if (!oneSignal) {
    console.warn("OneSignal: Not initialized");
    return;
  }

  try {
    await oneSignal.Slidedown.promptPush({ force: true });
  } catch (error) {
    console.error("OneSignal: Prompt error", error);
  }
}

/**
 * Check if user has granted push permission
 */
export function hasPushPermission(): boolean {
  const oneSignal = getOneSignal();
  if (!oneSignal) return false;

  return oneSignal.Notifications.permission;
}

/**
 * Check if user is subscribed to push notifications
 */
export function isPushSubscribed(): boolean {
  const oneSignal = getOneSignal();
  if (!oneSignal) return false;

  return oneSignal.User.PushSubscription.optedIn;
}

/**
 * Get the push subscription token (player ID)
 */
export function getPushSubscriptionId(): string | null {
  const oneSignal = getOneSignal();
  if (!oneSignal) return null;

  return oneSignal.User.PushSubscription.id || null;
}

/**
 * Opt in to push notifications
 */
export async function optInToPush(): Promise<void> {
  const oneSignal = getOneSignal();
  if (!oneSignal) {
    console.warn("OneSignal: Not initialized");
    return;
  }

  try {
    await oneSignal.User.PushSubscription.optIn();
    console.log("OneSignal: Opted in to push");
  } catch (error) {
    console.error("OneSignal: Opt in error", error);
  }
}

/**
 * Opt out of push notifications
 */
export async function optOutOfPush(): Promise<void> {
  const oneSignal = getOneSignal();
  if (!oneSignal) {
    console.warn("OneSignal: Not initialized");
    return;
  }

  try {
    await oneSignal.User.PushSubscription.optOut();
    console.log("OneSignal: Opted out of push");
  } catch (error) {
    console.error("OneSignal: Opt out error", error);
  }
}

/**
 * Add tags for user segmentation
 */
export function addUserTags(tags: Record<string, string>): void {
  const oneSignal = getOneSignal();
  if (!oneSignal) return;

  oneSignal.User.addTags(tags);
}

/**
 * Remove tags
 */
export function removeUserTags(keys: string[]): void {
  const oneSignal = getOneSignal();
  if (!oneSignal) return;

  oneSignal.User.removeTags(keys);
}
