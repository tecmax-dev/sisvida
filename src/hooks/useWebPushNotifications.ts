import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  initializePusherBeams,
  subscribeToNotifications,
  isSubscribed as checkIsSubscribed,
  addDeviceInterest,
} from '@/lib/pusher-beams';
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
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasPushManager = 'PushManager' in window;
      const hasNotification = 'Notification' in window;
      
      console.log('Web Push Support Check:', {
        serviceWorker: hasServiceWorker,
        pushManager: hasPushManager,
        notification: hasNotification,
      });
      
      const browserSupported = hasServiceWorker && hasPushManager && hasNotification;
      
      if (!browserSupported) {
        console.warn('Web Push: Browser does not support push notifications');
        setIsSupported(false);
        return;
      }
      
      setIsSupported(true);
    };
    checkSupport();
  }, []);

  // Register token with backend
  const registerToken = useCallback(async (deviceId: string) => {
    if (!clinicId) {
      console.log('Pusher Beams: Missing clinicId');
      return false;
    }

    console.log('Pusher Beams: Registering Device ID...', deviceId.substring(0, 20) + '...');

    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Pusher Beams: Auth error:', authError);
      }
      
      const userId = user?.id || null;
      
      // Normalize patientId - treat empty string as null
      const normalizedPatientId = patientId && patientId.trim() !== '' ? patientId : null;

      console.log('Pusher Beams: Identifiers check:', {
        patientId: normalizedPatientId ? 'present' : 'null',
        userId: userId ? 'present' : 'null',
      });

      // We need at least one identifier - check AFTER getting userId
      if (!normalizedPatientId && !userId) {
        console.error('Pusher Beams: Cannot register - no patientId or userId available. User must be authenticated.');
        return false;
      }

      // Deactivate stale tokens for the SAME device (same userAgent) so we don't keep sending to invalid IDs
      try {
        let deactivateQuery = supabase
          .from('push_notification_tokens')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('clinic_id', clinicId)
          .eq('platform', 'web')
          .eq('is_active', true)
          .eq('device_info->>userAgent', navigator.userAgent)
          .neq('token', deviceId);

        if (normalizedPatientId) {
          deactivateQuery = deactivateQuery.eq('patient_id', normalizedPatientId);
        } else if (userId) {
          deactivateQuery = deactivateQuery.eq('user_id', userId);
        }

        const { error: deactivateError } = await deactivateQuery;
        if (deactivateError) {
          console.warn('Pusher Beams: Could not deactivate stale tokens for this device:', deactivateError);
        }
      } catch (e) {
        console.warn('Pusher Beams: Error while deactivating stale tokens:', e);
      }

      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          patient_id: normalizedPatientId,
          user_id: userId,
          clinic_id: clinicId,
          token: deviceId,
          platform: 'web',
          is_active: true,
          device_info: {
            platform: 'web',
            isNative: false,
            userAgent: navigator.userAgent,
            type: 'pusher-beams-web'
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'clinic_id,token',
        });

      if (error) {
        console.error('Pusher Beams: Error registering token:', error);
        return false;
      }
      
      console.log('Pusher Beams: Token registered successfully');
      return true;
    } catch (err) {
      console.error('Pusher Beams: Exception registering token:', err);
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
      console.log('Pusher Beams: Current permission state:', currentPermission);
      
      if (currentPermission === 'denied') {
        toast.error('Notificações bloqueadas. Acesse as configurações do navegador para permitir.');
        setIsLoading(false);
        return false;
      }

      // Initialize Pusher Beams
      const initialized = await initializePusherBeams();
      if (!initialized) {
        toast.error('Erro ao inicializar serviço de notificações');
        setIsLoading(false);
        return false;
      }

      // Subscribe to push notifications
      console.log('Pusher Beams: Subscribing to notifications...');
      const deviceId = await subscribeToNotifications();
      
      if (!deviceId) {
        const permission = Notification.permission;
        if (permission === 'denied') {
          toast.error('Permissão negada. Habilite nas configurações do navegador.');
        } else {
          toast.error('Erro ao ativar notificações. Tente novamente.');
        }
        setIsLoading(false);
        return false;
      }

      // Add device interests for targeting
      if (clinicId) {
        await addDeviceInterest(`clinic-${clinicId}`);
      }
      if (patientId) {
        await addDeviceInterest(`patient-${patientId}`);
      }

      // Register with backend
      const success = await registerToken(deviceId);
      
      if (success) {
        setIsSubscribed(true);
        toast.success('Notificações ativadas com sucesso!');
      } else {
        toast.error('Erro ao salvar configuração de notificações');
      }

      setIsLoading(false);
      return success;
    } catch (error) {
      console.error('Pusher Beams: Error subscribing:', error);
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
        // Check browser permission first
        const permission = Notification.permission;
        console.log('Web Push: Browser permission state:', permission);
        
        if (permission !== 'granted') {
          setIsSubscribed(false);
          return;
        }
        
        // Permission is granted, verify with Pusher Beams
        await initializePusherBeams();
        const beamsSubscribed = await checkIsSubscribed();
        console.log('Web Push: Pusher Beams subscription state:', beamsSubscribed);
        
        if (!beamsSubscribed) {
          setIsSubscribed(false);
          return;
        }
        
        // Finally check database for token registration
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
        
        // Only considered subscribed if ALL checks pass
        const fullySubscribed = permission === 'granted' && beamsSubscribed && !!data;
        console.log('Web Push: Full subscription check:', { permission, beamsSubscribed, hasDbRecord: !!data, fullySubscribed });
        setIsSubscribed(fullySubscribed);
      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsSubscribed(false);
      }
    };

    checkExistingSubscription();
  }, [isSupported, patientId, clinicId]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
  };
}
