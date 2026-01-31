// OneSignal Web Push Configuration
// Documentation: https://documentation.onesignal.com/docs/web-push-sdk

// Extend Window interface for OneSignal
declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalInstance) => void | Promise<void>>;
  }
}

interface OneSignalInstance {
  init: (config: Record<string, unknown>) => Promise<void>;
  Notifications: {
    requestPermission: () => Promise<void>;
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

// Version for cache busting
const ONESIGNAL_CONFIG_VERSION = '2026-01-31-v1';

let isInitialized = false;

export async function initializeOneSignal(): Promise<boolean> {
  if (isInitialized) {
    console.log('OneSignal: Already initialized');
    return true;
  }

  if (!ONESIGNAL_APP_ID) {
    console.warn('OneSignal: App ID not configured, Web Push disabled');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('OneSignal: Service Worker not supported');
    return false;
  }

  if (!('PushManager' in window)) {
    console.warn('OneSignal: Push notifications not supported');
    return false;
  }

  try {
    console.log('OneSignal: Initializing with version:', ONESIGNAL_CONFIG_VERSION);
    
    // Wait for OneSignal SDK to be ready
    await new Promise<void>((resolve) => {
      // @ts-ignore
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      // @ts-ignore
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            safari_web_id: undefined,
            notifyButton: {
              enable: false,
            },
            promptOptions: {
              native: {
                enabled: true,
                autoPrompt: false,
              },
              slidedown: {
                enabled: false,
                prompts: [],
              },
            },
            allowLocalhostAsSecureOrigin: true,
          });
          
          console.log('OneSignal: SDK initialized successfully');
          isInitialized = true;
          resolve();
        } catch (error) {
          console.error('OneSignal: Initialization error:', error);
          resolve();
        }
      });
    });

    return isInitialized;
  } catch (error) {
    console.error('OneSignal: Error initializing:', error);
    return false;
  }
}

export async function subscribeToNotifications(): Promise<string | null> {
  if (!isInitialized) {
    const initialized = await initializeOneSignal();
    if (!initialized) {
      console.error('OneSignal: Failed to initialize');
      return null;
    }
  }

  try {
    // Check current permission state
    const currentPermission = Notification.permission;
    console.log('OneSignal: Current permission state:', currentPermission);
    
    if (currentPermission === 'denied') {
      console.log('OneSignal: Permission was denied previously');
      return null;
    }

    return new Promise((resolve) => {
      // @ts-ignore
      window.OneSignalDeferred?.push(async (OneSignal: any) => {
        try {
          // Request permission and subscribe
          console.log('OneSignal: Requesting permission...');
          await OneSignal.Notifications.requestPermission();
          
          // Wait a bit for Player ID to be available
          let playerId: string | null = null;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!playerId && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 500));
            playerId = await OneSignal.User.PushSubscription.id;
            attempts++;
            console.log(`OneSignal: Attempt ${attempts} - Player ID:`, playerId ? playerId.substring(0, 12) + '...' : 'null');
          }
          
          if (playerId) {
            console.log('OneSignal: Successfully subscribed');
            resolve(playerId);
          } else {
            console.warn('OneSignal: Could not get Player ID');
            resolve(null);
          }
        } catch (error) {
          console.error('OneSignal: Subscription error:', error);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('OneSignal: Error subscribing:', error);
    return null;
  }
}

export async function getPlayerId(): Promise<string | null> {
  return new Promise((resolve) => {
    // @ts-ignore
    window.OneSignalDeferred?.push(async (OneSignal: any) => {
      try {
        const playerId = await OneSignal.User.PushSubscription.id;
        resolve(playerId || null);
      } catch (error) {
        console.error('OneSignal: Error getting Player ID:', error);
        resolve(null);
      }
    });
  });
}

export async function isSubscribed(): Promise<boolean> {
  return new Promise((resolve) => {
    // @ts-ignore
    if (!window.OneSignalDeferred) {
      resolve(false);
      return;
    }
    
    // @ts-ignore
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        const optedIn = await OneSignal.User.PushSubscription.optedIn;
        const playerId = await OneSignal.User.PushSubscription.id;
        resolve(optedIn && !!playerId);
      } catch (error) {
        console.error('OneSignal: Error checking subscription:', error);
        resolve(false);
      }
    });
  });
}

export async function setExternalUserId(userId: string): Promise<void> {
  return new Promise((resolve) => {
    // @ts-ignore
    window.OneSignalDeferred?.push(async (OneSignal: any) => {
      try {
        await OneSignal.login(userId);
        console.log('OneSignal: External user ID set:', userId);
        resolve();
      } catch (error) {
        console.error('OneSignal: Error setting external user ID:', error);
        resolve();
      }
    });
  });
}

export async function addTag(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    // @ts-ignore
    window.OneSignalDeferred?.push(async (OneSignal: any) => {
      try {
        await OneSignal.User.addTag(key, value);
        console.log('OneSignal: Tag added:', key, value);
        resolve();
      } catch (error) {
        console.error('OneSignal: Error adding tag:', error);
        resolve();
      }
    });
  });
}

/**
 * Clear local OneSignal state to force a fresh registration.
 * This is useful when recovering from stale token states.
 */
export async function clearLocalState(): Promise<void> {
  console.log('OneSignal: Clearing local state...');
  
  try {
    // Reset module state
    isInitialized = false;
    
    console.log('OneSignal: Local state cleared successfully');
  } catch (error) {
    console.error('OneSignal: Error clearing local state:', error);
    isInitialized = false;
  }
}
