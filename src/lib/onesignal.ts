// OneSignal Web Push Configuration
// Documentation: https://documentation.onesignal.com/docs/web-push-sdk

// Extend Window interface for OneSignal
declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalInstance) => void | Promise<void>>;
    OneSignal?: OneSignalInstance;
  }
}

interface OneSignalInstance {
  init: (config: Record<string, unknown>) => Promise<void>;
  Notifications: {
    requestPermission: () => Promise<void>;
    permission: boolean;
  };
  User: {
    PushSubscription: {
      id: string | null;
      optedIn: boolean;
    };
    addTag: (key: string, value: string) => Promise<void>;
  };
  login: (userId: string) => Promise<void>;
}

// Public App ID (safe to expose in frontend code)
const ONESIGNAL_APP_ID = '8522abd2-4541-4ada-9f7c-49d453642042';

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialize OneSignal SDK - handles multiple calls gracefully
 */
export async function initializeOneSignal(): Promise<boolean> {
  // Already initialized
  if (isInitialized && window.OneSignal) {
    console.log('OneSignal: Already initialized');
    return true;
  }

  // Initialization in progress - wait for it
  if (initPromise) {
    console.log('OneSignal: Initialization in progress, waiting...');
    return initPromise;
  }

  if (!ONESIGNAL_APP_ID) {
    console.warn('OneSignal: App ID not configured');
    return false;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('OneSignal: Browser does not support push notifications');
    return false;
  }

  // Create initialization promise
  initPromise = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('OneSignal: Initialization timeout');
      initPromise = null;
      resolve(false);
    }, 10000);

    // Ensure deferred array exists
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    
    window.OneSignalDeferred.push(async (OneSignal: OneSignalInstance) => {
      try {
        // Check if already initialized by checking if OneSignal has methods
        if (window.OneSignal && typeof window.OneSignal.Notifications?.requestPermission === 'function') {
          console.log('OneSignal: SDK already available');
          clearTimeout(timeout);
          isInitialized = true;
          resolve(true);
          return;
        }

        console.log('OneSignal: Initializing SDK...');
        
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          notifyButton: { enable: false },
          promptOptions: {
            native: { enabled: true, autoPrompt: false },
            slidedown: { enabled: false },
          },
          allowLocalhostAsSecureOrigin: true,
        });

        // Store reference
        window.OneSignal = OneSignal;
        isInitialized = true;
        
        console.log('OneSignal: SDK initialized successfully');
        clearTimeout(timeout);
        resolve(true);
      } catch (error) {
        console.error('OneSignal: Initialization error:', error);
        clearTimeout(timeout);
        initPromise = null;
        resolve(false);
      }
    });
  });

  return initPromise;
}

/**
 * Subscribe to push notifications and get Player ID
 */
export async function subscribeToNotifications(): Promise<string | null> {
  const initialized = await initializeOneSignal();
  if (!initialized) {
    console.error('OneSignal: Failed to initialize');
    return null;
  }

  // Check browser permission
  const currentPermission = Notification.permission;
  console.log('OneSignal: Browser permission:', currentPermission);

  if (currentPermission === 'denied') {
    console.log('OneSignal: Permission denied by user');
    return null;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('OneSignal: Subscription timeout');
      resolve(null);
    }, 15000);

    window.OneSignalDeferred?.push(async (OneSignal: OneSignalInstance) => {
      try {
        console.log('OneSignal: Requesting permission...');
        await OneSignal.Notifications.requestPermission();

        // Wait for Player ID with retries
        let playerId: string | null = null;
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 300));
          playerId = OneSignal.User.PushSubscription.id;
          if (playerId) {
            console.log(`OneSignal: Got Player ID on attempt ${i + 1}`);
            break;
          }
        }

        clearTimeout(timeout);

        if (playerId) {
          console.log('OneSignal: Subscription successful');
          resolve(playerId);
        } else {
          console.warn('OneSignal: Could not get Player ID after permission granted');
          resolve(null);
        }
      } catch (error) {
        console.error('OneSignal: Subscription error:', error);
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
}

/**
 * Get current Player ID if available
 */
export async function getPlayerId(): Promise<string | null> {
  if (!window.OneSignal) {
    const initialized = await initializeOneSignal();
    if (!initialized) return null;
  }

  return new Promise((resolve) => {
    window.OneSignalDeferred?.push(async (OneSignal: OneSignalInstance) => {
      try {
        resolve(OneSignal.User.PushSubscription.id || null);
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * Check if user is subscribed
 */
export async function isSubscribed(): Promise<boolean> {
  if (!window.OneSignal) {
    return false;
  }

  return new Promise((resolve) => {
    window.OneSignalDeferred?.push(async (OneSignal: OneSignalInstance) => {
      try {
        const optedIn = OneSignal.User.PushSubscription.optedIn;
        const playerId = OneSignal.User.PushSubscription.id;
        resolve(optedIn && !!playerId);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Set external user ID for cross-device tracking
 */
export async function setExternalUserId(userId: string): Promise<void> {
  return new Promise((resolve) => {
    window.OneSignalDeferred?.push(async (OneSignal: OneSignalInstance) => {
      try {
        await OneSignal.login(userId);
        console.log('OneSignal: External user ID set');
      } catch (error) {
        console.error('OneSignal: Error setting external user ID:', error);
      }
      resolve();
    });
  });
}

/**
 * Add tag for segmentation
 */
export async function addTag(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    window.OneSignalDeferred?.push(async (OneSignal: OneSignalInstance) => {
      try {
        await OneSignal.User.addTag(key, value);
        console.log('OneSignal: Tag added:', key);
      } catch (error) {
        console.error('OneSignal: Error adding tag:', error);
      }
      resolve();
    });
  });
}

/**
 * Clear local state to force fresh registration
 */
export async function clearLocalState(): Promise<void> {
  console.log('OneSignal: Clearing local state...');
  isInitialized = false;
  initPromise = null;
}
