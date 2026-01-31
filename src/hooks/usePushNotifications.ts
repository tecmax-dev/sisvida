import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useWebPushNotifications } from './useWebPushNotifications';
import { useResolvedClinicId } from './useResolvedClinicId';

interface UsePushNotificationsOptions {
  patientId: string | null;
  clinicId: string | null;
}

export function usePushNotifications({ patientId, clinicId }: UsePushNotificationsOptions) {
  const [isNative, setIsNative] = useState(false);

  const { effectiveClinicId, isResolvingClinicId } = useResolvedClinicId(patientId, clinicId);
  
  // Web Push hook for PWA/browser
  const webPush = useWebPushNotifications({ patientId, clinicId: effectiveClinicId });

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Native Capacitor registration
  const registerNativeToken = useCallback(async (token: string) => {
    if (!patientId || !effectiveClinicId) {
      console.log('Push notifications: Missing patientId or clinicId');
      return;
    }

    const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
    
    console.log(`Push notifications: Registering token for ${platform}`, token.substring(0, 20) + '...');

    try {
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          patient_id: patientId,
          clinic_id: effectiveClinicId,
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
  }, [patientId, effectiveClinicId]);

  const initializeNativePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications: Not a native platform, using Web Push');
      return;
    }

    try {
      // Dynamic import for Capacitor Push Notifications (only on native)
      const { PushNotifications } = await import('@capacitor/push-notifications');
      
      let permStatus = await PushNotifications.checkPermissions();
      console.log('Push notifications: Permission status:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notifications: Permission not granted');
        return;
      }

      await PushNotifications.register();
      console.log('Push notifications: Registration initiated');

    } catch (err) {
      console.error('Push notifications: Error initializing:', err);
    }
  }, []);

  // Native listeners setup
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !patientId || !effectiveClinicId) {
      return;
    }

    let cleanup: (() => void)[] = [];

    const setupNativeListeners = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        const registrationListener = await PushNotifications.addListener('registration', (token) => {
          console.log('Push notifications: Registration token received:', token.value.substring(0, 20) + '...');
          registerNativeToken(token.value);
        });

        const registrationErrorListener = await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push notifications: Registration error:', error);
        });

        const pushNotificationReceivedListener = await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification) => {
            console.log('Push notifications: Notification received:', notification);
          }
        );

        const pushNotificationActionPerformedListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (notification) => {
            console.log('Push notifications: Action performed:', notification);
          }
        );

        cleanup = [
          () => registrationListener.remove(),
          () => registrationErrorListener.remove(),
          () => pushNotificationReceivedListener.remove(),
          () => pushNotificationActionPerformedListener.remove(),
        ];

        // Initialize
        await initializeNativePushNotifications();
      } catch (err) {
        console.error('Push notifications: Error setting up listeners:', err);
      }
    };

    setupNativeListeners();

    return () => {
      cleanup.forEach(fn => fn());
    };
  }, [patientId, effectiveClinicId, registerNativeToken, initializeNativePushNotifications]);

  return {
    // Native
    isNative,
    initializeNativePushNotifications,
    // Identifiers
    effectiveClinicId,
    isResolvingClinicId,
    // Web Push
    isWebPushSupported: webPush.isSupported,
    isWebPushSubscribed: webPush.isSubscribed,
    isWebPushLoading: webPush.isLoading,
    subscribeToWebPush: webPush.subscribe,
  };
}
