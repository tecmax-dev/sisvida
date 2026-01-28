// Firebase Web Push Configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function initializeFirebase(): FirebaseApp | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase config missing, Web Push disabled');
    return null;
  }

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  return app;
}

export async function initializeMessaging(): Promise<Messaging | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  if (!('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  const firebaseApp = initializeFirebase();
  if (!firebaseApp) return null;

  try {
    // Register the Firebase messaging service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    
    console.log('Firebase SW registered:', registration.scope);

    // Send Firebase config to the service worker
    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig
      });
    }

    // Wait for SW to be ready
    await navigator.serviceWorker.ready;

    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch (error) {
    console.error('Error initializing Firebase messaging:', error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('Notification permission:', permission);
  return permission;
}

export async function getWebPushToken(): Promise<string | null> {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  
  if (!vapidKey) {
    console.error('VAPID key not configured');
    return null;
  }

  try {
    const messagingInstance = await initializeMessaging();
    if (!messagingInstance) return null;

    const registration = await navigator.serviceWorker.ready;
    
    const token = await getToken(messagingInstance, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    console.log('Web Push token obtained:', token?.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('Error getting Web Push token:', error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  if (!messaging) {
    console.warn('Messaging not initialized');
    return null;
  }

  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });

  return unsubscribe;
}
