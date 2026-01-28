import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  requestNotificationPermission, 
  getWebPushToken, 
  onForegroundMessage,
  initializeMessaging
} from '@/lib/firebase';
import { toast } from 'sonner';

interface UseWebPushNotificationsOptions {
  patientId: string | null;
  clinicId: string | null;
}

export function useWebPushNotifications({ patientId, clinicId }: UseWebPushNotificationsOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if Web Push is supported
  useEffect(() => {
    const checkSupport = () => {
      const supported = 
        'serviceWorker' in navigator && 
        'PushManager' in window && 
        'Notification' in window;
      setIsSupported(supported);
    };
    checkSupport();
  }, []);

  // Register token with backend
  const registerToken = useCallback(async (token: string) => {
    if (!patientId || !clinicId) {
      console.log('Web Push: Missing patientId or clinicId');
      return false;
    }

    console.log('Web Push: Registering token...', token.substring(0, 20) + '...');

    try {
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          patient_id: patientId,
          clinic_id: clinicId,
          token: token,
          platform: 'web',
          is_active: true,
          device_info: {
            platform: 'web',
            isNative: false,
            userAgent: navigator.userAgent,
            type: 'web-push'
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'patient_id,token',
        });

      if (error) {
        console.error('Web Push: Error registering token:', error);
        return false;
      }
      
      console.log('Web Push: Token registered successfully');
      return true;
    } catch (err) {
      console.error('Web Push: Exception registering token:', err);
      return false;
    }
  }, [patientId, clinicId]);

  // Subscribe to Web Push
  const subscribe = useCallback(async () => {
    if (!isSupported || !patientId || !clinicId) {
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission
      const permission = await requestNotificationPermission();
      
      if (permission !== 'granted') {
        toast.error('Permissão de notificação negada');
        setIsLoading(false);
        return false;
      }

      // Get Web Push token
      const token = await getWebPushToken();
      
      if (!token) {
        toast.error('Erro ao obter token de notificação');
        setIsLoading(false);
        return false;
      }

      // Register with backend
      const success = await registerToken(token);
      
      if (success) {
        setIsSubscribed(true);
        toast.success('Notificações ativadas com sucesso!');
      }

      setIsLoading(false);
      return success;
    } catch (error) {
      console.error('Web Push: Error subscribing:', error);
      toast.error('Erro ao ativar notificações');
      setIsLoading(false);
      return false;
    }
  }, [isSupported, patientId, clinicId, registerToken]);

  // Initialize and check existing subscription
  useEffect(() => {
    if (!isSupported || !patientId || !clinicId) return;

    const checkExistingSubscription = async () => {
      try {
        // Check if already subscribed
        const { data } = await supabase
          .from('push_notification_tokens')
          .select('id')
          .eq('patient_id', patientId)
          .eq('clinic_id', clinicId)
          .eq('platform', 'web')
          .eq('is_active', true)
          .maybeSingle();

        if (data) {
          setIsSubscribed(true);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkExistingSubscription();
  }, [isSupported, patientId, clinicId]);

  // Set up foreground message handler
  useEffect(() => {
    if (!isSubscribed) return;

    const initMessages = async () => {
      await initializeMessaging();
      
      const unsubscribe = onForegroundMessage((payload) => {
        // Show toast for foreground notifications
        const title = payload.notification?.title || 'Nova notificação';
        const body = payload.notification?.body || '';
        
        toast.info(title, {
          description: body,
          duration: 5000,
        });
      });

      return unsubscribe;
    };

    let cleanup: (() => void) | null = null;
    
    initMessages().then(unsub => {
      cleanup = unsub;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [isSubscribed]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
  };
}
