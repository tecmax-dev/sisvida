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
  // Already initialized and SDK available
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
      console.warn('OneSignal: Initialization timeout after 10s');
      initPromise = null;
      resolve(false);
    }, 10000);

    // Ensure deferred array exists
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    
    // Push our init callback
    window.OneSignalDeferred.push(async (OneSignal: OneSignalInstance) => {
      try {
        // Check if SDK is already initialized by testing for the Notifications object
        const alreadyInitialized = OneSignal.Notifications && 
          typeof OneSignal.Notifications.requestPermission === 'function';
        
        if (alreadyInitialized) {
          console.log('OneSignal: SDK already initialized, reusing instance');
          window.OneSignal = OneSignal;
          isInitialized = true;
          clearTimeout(timeout);
          resolve(true);
          return;
        }

        console.log('OneSignal: Initializing SDK with App ID:', ONESIGNAL_APP_ID.substring(0, 8) + '...');
        
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          notifyButton: { enable: false },
          promptOptions: {
            native: { enabled: true, autoPrompt: false },
            slidedown: { enabled: false },
          },
          allowLocalhostAsSecureOrigin: true,
        });

        // Store reference globally
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
  if (!initialized || !window.OneSignal) {
    console.error('OneSignal: Failed to initialize or SDK not available');
    return null;
  }

  // Check browser permission
  const currentPermission = Notification.permission;
  console.log('OneSignal: Browser permission:', currentPermission);

  if (currentPermission === 'denied') {
    console.log('OneSignal: Permission denied by user');
    return null;
  }

  try {
    console.log('OneSignal: Requesting permission...');
    await window.OneSignal.Notifications.requestPermission();

    // Wait for Player ID with retries (up to 6 seconds)
    let playerId: string | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300));
      playerId = window.OneSignal.User.PushSubscription.id;
      if (playerId) {
        console.log(`OneSignal: Got Player ID on attempt ${i + 1}: ${playerId.substring(0, 12)}...`);
        break;
      }
    }

    if (playerId) {
      console.log('OneSignal: Subscription successful');
      return playerId;
    } else {
      console.warn('OneSignal: Could not get Player ID after permission granted');
      return null;
    }
  } catch (error) {
    console.error('OneSignal: Subscription error:', error);
    return null;
  }
}

/**
 * Get current Player ID if available
 */
export async function getPlayerId(): Promise<string | null> {
  // Try to use the global reference directly first
  if (window.OneSignal) {
    try {
      return window.OneSignal.User.PushSubscription.id || null;
    } catch {
      return null;
    }
  }

  // If not available, try to initialize
  const initialized = await initializeOneSignal();
  if (!initialized || !window.OneSignal) return null;

  try {
    return window.OneSignal.User.PushSubscription.id || null;
  } catch {
    return null;
  }
}

/**
 * Check if user is subscribed
 */
export async function isSubscribed(): Promise<boolean> {
  // Try to use the global reference directly
  if (window.OneSignal) {
    try {
      const optedIn = window.OneSignal.User.PushSubscription.optedIn;
      const playerId = window.OneSignal.User.PushSubscription.id;
      return optedIn && !!playerId;
    } catch {
      return false;
    }
  }

  // If OneSignal not available, we're definitely not subscribed
  return false;
}

/**
 * Set external user ID for cross-device tracking
 */
export async function setExternalUserId(userId: string): Promise<void> {
  if (!window.OneSignal) {
    await initializeOneSignal();
  }
  
  if (!window.OneSignal) {
    console.warn('OneSignal: Cannot set external user ID - SDK not available');
    return;
  }

  try {
    await window.OneSignal.login(userId);
    console.log('OneSignal: External user ID set');
  } catch (error) {
    console.error('OneSignal: Error setting external user ID:', error);
  }
}

/**
 * Add tag for segmentation
 */
export async function addTag(key: string, value: string): Promise<void> {
  if (!window.OneSignal) {
    await initializeOneSignal();
  }
  
  if (!window.OneSignal) {
    console.warn('OneSignal: Cannot add tag - SDK not available');
    return;
  }

  try {
    await window.OneSignal.User.addTag(key, value);
    console.log('OneSignal: Tag added:', key);
  } catch (error) {
    console.error('OneSignal: Error adding tag:', error);
  }
}

/**
 * Clear local state to force fresh registration
 */
export async function clearLocalState(): Promise<void> {
  console.log('OneSignal: Clearing local state...');
  isInitialized = false;
  initPromise = null;
}
