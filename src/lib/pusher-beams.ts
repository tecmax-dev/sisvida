// Pusher Beams Web Push Configuration
// Documentation: https://pusher.com/docs/beams/reference/web/

import * as PusherPushNotifications from '@pusher/push-notifications-web';

// Public Instance ID (safe to expose in frontend code)
const PUSHER_BEAMS_INSTANCE_ID = '2d0e3c28-2e91-4fca-8686-332c4dfc5234';

let beamsClient: PusherPushNotifications.Client | null = null;
let isInitialized = false;

export async function initializePusherBeams(): Promise<boolean> {
  if (isInitialized && beamsClient) {
    console.log('Pusher Beams: Already initialized');
    return true;
  }

  if (!PUSHER_BEAMS_INSTANCE_ID) {
    console.warn('Pusher Beams: Instance ID not configured, Web Push disabled');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('Pusher Beams: Service Worker not supported');
    return false;
  }

  if (!('PushManager' in window)) {
    console.warn('Pusher Beams: Push notifications not supported');
    return false;
  }

  try {
    beamsClient = new PusherPushNotifications.Client({
      instanceId: PUSHER_BEAMS_INSTANCE_ID,
    });

    console.log('Pusher Beams: Initialized successfully');
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Pusher Beams: Error initializing:', error);
    return false;
  }
}

export async function subscribeToNotifications(): Promise<string | null> {
  if (!beamsClient) {
    const initialized = await initializePusherBeams();
    if (!initialized || !beamsClient) {
      console.error('Pusher Beams: Failed to initialize');
      return null;
    }
  }

  try {
    // Check current permission state
    const currentPermission = Notification.permission;
    console.log('Pusher Beams: Current permission state:', currentPermission);
    
    if (currentPermission === 'denied') {
      console.log('Pusher Beams: Permission was denied previously');
      return null;
    }

    // Start the client - this will request permission if needed
    console.log('Pusher Beams: Starting client...');
    await beamsClient.start();

    // Get the device ID
    const deviceId = await beamsClient.getDeviceId();
    console.log('Pusher Beams: Device ID:', deviceId ? deviceId.substring(0, 20) + '...' : 'null');

    if (!deviceId) {
      console.warn('Pusher Beams: No device ID available');
      return null;
    }

    console.log('Pusher Beams: Successfully subscribed');
    return deviceId;
  } catch (error) {
    console.error('Pusher Beams: Subscription error:', error);
    return null;
  }
}

export async function setUserId(userId: string, tokenProvider?: PusherPushNotifications.TokenProvider): Promise<void> {
  if (!beamsClient) {
    console.warn('Pusher Beams: Client not initialized');
    return;
  }

  try {
    if (tokenProvider) {
      await beamsClient.setUserId(userId, tokenProvider);
      console.log('Pusher Beams: User ID set:', userId);
    }
  } catch (error) {
    console.error('Pusher Beams: Error setting user ID:', error);
  }
}

export async function addDeviceInterest(interest: string): Promise<void> {
  if (!beamsClient) {
    console.warn('Pusher Beams: Client not initialized');
    return;
  }

  try {
    await beamsClient.addDeviceInterest(interest);
    console.log('Pusher Beams: Added interest:', interest);
  } catch (error) {
    console.error('Pusher Beams: Error adding interest:', error);
  }
}

export async function setDeviceInterests(interests: string[]): Promise<void> {
  if (!beamsClient) {
    console.warn('Pusher Beams: Client not initialized');
    return;
  }

  try {
    await beamsClient.setDeviceInterests(interests);
    console.log('Pusher Beams: Set interests:', interests);
  } catch (error) {
    console.error('Pusher Beams: Error setting interests:', error);
  }
}

export async function getDeviceInterests(): Promise<string[]> {
  if (!beamsClient) {
    console.warn('Pusher Beams: Client not initialized');
    return [];
  }

  try {
    return await beamsClient.getDeviceInterests();
  } catch (error) {
    console.error('Pusher Beams: Error getting interests:', error);
    return [];
  }
}

export async function clearDeviceInterests(): Promise<void> {
  if (!beamsClient) {
    console.warn('Pusher Beams: Client not initialized');
    return;
  }

  try {
    await beamsClient.clearDeviceInterests();
    console.log('Pusher Beams: Cleared interests');
  } catch (error) {
    console.error('Pusher Beams: Error clearing interests:', error);
  }
}

export async function getDeviceId(): Promise<string | null> {
  if (!beamsClient) {
    return null;
  }

  try {
    return await beamsClient.getDeviceId();
  } catch (error) {
    console.error('Pusher Beams: Error getting device ID:', error);
    return null;
  }
}

export async function isSubscribed(): Promise<boolean> {
  if (!beamsClient) {
    return false;
  }

  try {
    const deviceId = await beamsClient.getDeviceId();
    return !!deviceId;
  } catch (error) {
    console.error('Pusher Beams: Error checking subscription:', error);
    return false;
  }
}

export async function stopBeams(): Promise<void> {
  if (!beamsClient) {
    return;
  }

  try {
    await beamsClient.stop();
    console.log('Pusher Beams: Stopped');
    isInitialized = false;
    beamsClient = null;
  } catch (error) {
    console.error('Pusher Beams: Error stopping:', error);
  }
}

export function getClient(): PusherPushNotifications.Client | null {
  return beamsClient;
}
