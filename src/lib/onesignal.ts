// OneSignal Web Push Configuration
// Documentation: https://documentation.onesignal.com/docs/web-push-sdk

// Note: App ID is a public key (safe to expose in frontend code)
const ONESIGNAL_APP_ID = '8522abd2-4541-4ada-9f7c-49d453642042';

let isInitialized = false;

export interface OneSignalUser {
  pushSubscription: {
    id: string | null;
    token: string | null;
    optedIn: boolean;
  };
}

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
    // Dynamically load OneSignal SDK
    if (!window.OneSignalDeferred) {
      window.OneSignalDeferred = [];
    }

    // Load the SDK script if not already present
    if (!document.querySelector('script[src*="OneSignalSDK"]')) {
      await loadOneSignalScript();
    }

    // Initialize OneSignal
    await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred.push(async (OneSignal: any) => {
          try {
            await OneSignal.init({
              appId: ONESIGNAL_APP_ID,
              allowLocalhostAsSecureOrigin: true,
              // IMPORTANT: Browsers only allow ONE Service Worker per scope.
              // Our PWA SW is /sw.js at scope '/'. We load OneSignal's worker code
              // into it via Workbox `importScripts` (see vite.config.ts).
              // Therefore OneSignal must use the app SW path here.
              serviceWorkerPath: '/sw.js',
              serviceWorkerParam: { scope: '/' },
              notifyButton: {
                enable: false, // We use our own UI
              },
              welcomeNotification: {
                disable: true, // Disable default welcome notification
              },
              promptOptions: {
                autoPrompt: false, // We control when to prompt
                native: {
                  enabled: true, // Use native browser prompt only
                },
                slidedown: {
                  enabled: false, // Completely disable slidedown to prevent English default
                  prompts: [],
                },
                customlink: {
                  enabled: false,
                },
              },
            });
          console.log('OneSignal: Initialized successfully');
          isInitialized = true;
          resolve();
        } catch (error) {
          console.error('OneSignal: Initialization failed:', error);
          reject(error);
        }
      });
    });

    return true;
  } catch (error) {
    console.error('OneSignal: Error initializing:', error);
    return false;
  }
}

export async function getPushSubscriptionState(): Promise<OneSignalUser['pushSubscription'] | null> {
  if (!isInitialized) {
    return null;
  }

  try {
    return await new Promise((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          const subscription = OneSignal?.User?.PushSubscription;
          resolve({
            id: subscription?.id ?? null,
            token: subscription?.token ?? null,
            optedIn: !!subscription?.optedIn,
          });
        } catch (error) {
          console.error('OneSignal: Error reading subscription state:', error);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('OneSignal: Error reading subscription state:', error);
    return null;
  }
}

function loadOneSignalScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load OneSignal SDK'));
    document.head.appendChild(script);
  });
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('OneSignal: Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('OneSignal: Notification permission:', permission);
  return permission;
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
    return await new Promise((resolve, reject) => {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          // Check current permission state
          const currentPermission = Notification.permission;
          console.log('OneSignal: Current permission state:', currentPermission);
          
          if (currentPermission === 'denied') {
            console.log('OneSignal: Permission was denied previously');
            resolve(null);
            return;
          }

          // If permission not yet granted, use native browser prompt
          // (The slidedown sometimes shows English text)
          if (currentPermission !== 'granted') {
            console.log('OneSignal: Requesting native browser permission...');
            
            // Use native browser API for permission request
            const newPermission = await Notification.requestPermission();
            console.log('OneSignal: Permission after prompt:', newPermission);
            
            if (newPermission !== 'granted') {
              console.log('OneSignal: Permission not granted');
              resolve(null);
              return;
            }
          }

          // Opt in to push
          console.log('OneSignal: Opting in to push notifications...');
          await OneSignal.User.PushSubscription.optIn();
          
          // Wait for subscription to propagate with retry logic
          let playerId: string | null = null;
          const maxRetries = 5;
          
          for (let i = 0; i < maxRetries; i++) {
            await new Promise(r => setTimeout(r, 1000));
            
            const subscription = OneSignal.User.PushSubscription;
            playerId = subscription?.id || null;
            
            console.log(`OneSignal: Attempt ${i + 1}/${maxRetries} - Player ID:`, playerId ? playerId.substring(0, 20) + '...' : 'null');
            
            if (playerId) {
              break;
            }
          }
          
          if (playerId) {
            console.log('OneSignal: Successfully subscribed with Player ID:', playerId.substring(0, 20) + '...');
            resolve(playerId);
          } else {
            console.warn('OneSignal: No Player ID available after retries. Subscription state:', {
              optedIn: OneSignal.User.PushSubscription?.optedIn,
              token: OneSignal.User.PushSubscription?.token ? 'present' : 'missing',
            });
            resolve(null);
          }
        } catch (error) {
          console.error('OneSignal: Subscription error:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('OneSignal: Error subscribing:', error);
    return null;
  }
}

export async function getSubscriptionId(): Promise<string | null> {
  if (!isInitialized) {
    return null;
  }

  try {
    return await new Promise((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          const subscription = OneSignal.User.PushSubscription;
          const playerId = subscription?.id || null;
          resolve(playerId);
        } catch (error) {
          console.error('OneSignal: Error getting subscription ID:', error);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('OneSignal: Error getting subscription ID:', error);
    return null;
  }
}

export async function isSubscribed(): Promise<boolean> {
  const state = await getPushSubscriptionState();
  return !!state?.optedIn;
}

export async function setExternalUserId(userId: string): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    await new Promise<void>((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
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
  } catch (error) {
    console.error('OneSignal: Error setting external user ID:', error);
  }
}

export async function addTags(tags: Record<string, string>): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    await new Promise<void>((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          await OneSignal.User.addTags(tags);
          console.log('OneSignal: Tags added:', tags);
          resolve();
        } catch (error) {
          console.error('OneSignal: Error adding tags:', error);
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('OneSignal: Error adding tags:', error);
  }
}

// Type augmentation for window object
declare global {
  interface Window {
    OneSignalDeferred: Array<(OneSignal: any) => void | Promise<void>>;
  }
}
