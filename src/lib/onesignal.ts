// OneSignal Web Push Configuration
// Documentation: https://documentation.onesignal.com/docs/web-push-sdk

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

let isInitialized = false;

export interface OneSignalUser {
  pushSubscription: {
    id: string | null;
    token: string | null;
    optedIn: boolean;
  };
}

async function clearPreviousOneSignalData(): Promise<void> {
  try {
    // Unregister any existing OneSignal service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.scope.includes('OneSignal') || 
            registration.active?.scriptURL?.includes('OneSignal')) {
          await registration.unregister();
          console.log('OneSignal: Unregistered old service worker');
        }
      }
    }

    // Clear OneSignal IndexedDB databases
    const databases = await indexedDB.databases?.() || [];
    for (const db of databases) {
      if (db.name && (db.name.includes('OneSignal') || db.name.includes('onesignal'))) {
        indexedDB.deleteDatabase(db.name);
        console.log('OneSignal: Cleared IndexedDB:', db.name);
      }
    }

    // Clear OneSignal localStorage items
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('OneSignal') || key.includes('onesignal'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('OneSignal: Cleared localStorage:', key);
    });
  } catch (error) {
    console.warn('OneSignal: Error clearing previous data:', error);
  }
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
    // Clear any previous OneSignal data that might cause App ID mismatch
    await clearPreviousOneSignalData();

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
            notifyButton: {
              enable: false, // We use our own UI
            },
            promptOptions: {
              slidedown: {
                prompts: [
                  {
                    type: 'push',
                    autoPrompt: false, // We control when to prompt
                    text: {
                      acceptButton: 'Permitir',
                      cancelButton: 'Agora não',
                    },
                  },
                ],
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
          // Check current permission
          console.log('OneSignal: Requesting notification permission...');
          const permission = await Notification.requestPermission();
          console.log('OneSignal: Permission result:', permission);
          
          if (permission !== 'granted') {
            console.log('OneSignal: Permission not granted:', permission);
            resolve(null);
            return;
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
  if (!isInitialized) {
    return false;
  }

  try {
    return await new Promise((resolve) => {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          const subscription = OneSignal.User.PushSubscription;
          const optedIn = subscription?.optedIn || false;
          resolve(optedIn);
        } catch (error) {
          console.error('OneSignal: Error checking subscription:', error);
          resolve(false);
        }
      });
    });
  } catch (error) {
    return false;
  }
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
