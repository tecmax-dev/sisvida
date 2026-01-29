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

async function clearPreviousOneSignalData(): Promise<void> {
  try {
    console.log('OneSignal: Starting data cleanup...');
    
    // IMPORTANT: Do NOT unregister service workers - they are needed for push notifications!
    // Only clear stale localStorage/sessionStorage data if there's an App ID mismatch

    // Check if we have a stored App ID that doesn't match current
    const storedAppId = localStorage.getItem('onesignal-app-id');
    if (storedAppId && storedAppId !== ONESIGNAL_APP_ID) {
      console.log('OneSignal: App ID mismatch, clearing old data...');
      
      // Clear OneSignal localStorage items only on mismatch
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('OneSignal') || 
          key.includes('onesignal') ||
          key.includes('ONE_SIGNAL') ||
          key.includes('os_')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('OneSignal: Cleared localStorage:', key);
      });
    }
    
    // Store current App ID
    localStorage.setItem('onesignal-app-id', ONESIGNAL_APP_ID);
    
    console.log('OneSignal: Cleanup completed');
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
            welcomeNotification: {
              disable: true, // Disable default welcome notification
            },
            promptOptions: {
              autoPrompt: false, // We control when to prompt
              slidedown: {
                prompts: [
                  {
                    type: 'push',
                    autoPrompt: false,
                    text: {
                      actionMessage: 'Deseja receber notificações do sindicato?',
                      acceptButton: 'Permitir',
                      cancelButton: 'Agora não',
                    },
                  },
                ],
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
