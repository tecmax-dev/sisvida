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
    if (!clinicId) {
      console.log('Web Push: Missing clinicId');
      return false;
    }

    console.log('Web Push: Registering token...', token.substring(0, 20) + '...');

    try {
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          patient_id: patientId || null,
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
          onConflict: 'clinic_id,token',
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
    if (!isSupported) {
      toast.error('Seu navegador não suporta notificações push');
      return false;
    }
    
    if (!clinicId) {
      toast.error('Faça login para ativar notificações');
      return false;
    }

    setIsLoading(true);

    try {
      // Check current permission state first
      const currentPermission = Notification.permission;
      console.log('Web Push: Current permission state:', currentPermission);
      
      if (currentPermission === 'denied') {
        toast.error('Notificações bloqueadas. Acesse as configurações do navegador para permitir.');
        setIsLoading(false);
        return false;
      }

      // Request permission
      const permission = await requestNotificationPermission();
      console.log('Web Push: Permission after request:', permission);
      
      if (permission !== 'granted') {
        if (permission === 'denied') {
          toast.error('Permissão negada. Habilite nas configurações do navegador.');
        } else {
          toast.error('Permissão de notificação não concedida');
        }
        setIsLoading(false);
        return false;
      }

      // Get Web Push token
      console.log('Web Push: Getting FCM token...');
      const token = await getWebPushToken();
      
      if (!token) {
        toast.error('Erro ao configurar notificações. Verifique a configuração do Firebase.');
        setIsLoading(false);
        return false;
      }

      // Register with backend
      const success = await registerToken(token);
      
      if (success) {
        setIsSubscribed(true);
        toast.success('Notificações ativadas com sucesso!');
      } else {
        toast.error('Erro ao salvar configuração de notificações');
      }

      setIsLoading(false);
      return success;
    } catch (error) {
      console.error('Web Push: Error subscribing:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao ativar notificações: ${errorMessage}`);
      setIsLoading(false);
      return false;
    }
  }, [isSupported, patientId, clinicId, registerToken]);

  // Initialize and check existing subscription
  useEffect(() => {
    if (!isSupported || !clinicId) return;

    const checkExistingSubscription = async () => {
      try {
        // Check if already subscribed - for admin context, check by clinic only
        let query = supabase
          .from('push_notification_tokens')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('platform', 'web')
          .eq('is_active', true);
        
        if (patientId) {
          query = query.eq('patient_id', patientId);
        }
        
        const { data } = await query.maybeSingle();

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
