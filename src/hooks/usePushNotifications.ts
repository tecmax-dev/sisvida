import { useEffect, useCallback } from 'react';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

interface UsePushNotificationsOptions {
  patientId: string | null;
  clinicId: string | null;
}

export function usePushNotifications({ patientId, clinicId }: UsePushNotificationsOptions) {
  
  const registerToken = useCallback(async (token: string) => {
    if (!patientId || !clinicId) {
      console.log('Push notifications: Missing patientId or clinicId');
      return;
    }

    const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
    
    console.log(`Push notifications: Registering token for ${platform}`, token.substring(0, 20) + '...');

    try {
      // Upsert token (insert or update if exists)
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          patient_id: patientId,
          clinic_id: clinicId,
          token: token,
          platform: platform,
          is_active: true,
          device_info: {
            platform: Capacitor.getPlatform(),
            isNative: Capacitor.isNativePlatform(),
            userAgent: navigator.userAgent,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'patient_id,token',
        });

      if (error) {
        console.error('Push notifications: Error registering token:', error);
      } else {
        console.log('Push notifications: Token registered successfully');
      }
    } catch (err) {
      console.error('Push notifications: Exception registering token:', err);
    }
  }, [patientId, clinicId]);

  const initializePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications: Not a native platform, skipping initialization');
      return;
    }

    try {
      // Check current permission status
      let permStatus = await PushNotifications.checkPermissions();
      console.log('Push notifications: Permission status:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        // Request permission
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notifications: Permission not granted');
        return;
      }

      // Register with the push notification service (FCM/APNs)
      await PushNotifications.register();
      console.log('Push notifications: Registration initiated');

    } catch (err) {
      console.error('Push notifications: Error initializing:', err);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !patientId || !clinicId) {
      return;
    }

    // Add listeners
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push notifications: Registration token received:', token.value.substring(0, 20) + '...');
      registerToken(token.value);
    });

    const registrationErrorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push notifications: Registration error:', error);
    });

    const pushNotificationReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push notifications: Notification received:', notification);
        // You can show a local notification or update UI here
      }
    );

    const pushNotificationActionPerformedListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push notifications: Action performed:', notification);
        // Handle notification tap - navigate to specific screen, etc.
      }
    );

    // Initialize
    initializePushNotifications();

    // Cleanup listeners on unmount
    return () => {
      registrationListener.then(l => l.remove());
      registrationErrorListener.then(l => l.remove());
      pushNotificationReceivedListener.then(l => l.remove());
      pushNotificationActionPerformedListener.then(l => l.remove());
    };
  }, [patientId, clinicId, registerToken, initializePushNotifications]);

  return { initializePushNotifications };
}
