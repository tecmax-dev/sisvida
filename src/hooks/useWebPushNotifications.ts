import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  initializeOneSignal,
  subscribeToNotifications,
  isSubscribed as checkIsSubscribed,
  setExternalUserId,
  addTags,
} from '@/lib/onesignal';
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
      
      // Check browser support - OneSignal will be configured in onesignal.ts
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
  const registerToken = useCallback(async (playerId: string) => {
    if (!clinicId) {
      console.log('OneSignal: Missing clinicId');
      return false;
    }

    console.log('OneSignal: Registering Player ID...', playerId.substring(0, 20) + '...');

    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('OneSignal: Auth error:', authError);
      }
      
      const userId = user?.id || null;
      
      // Normalize patientId - treat empty string as null
      const normalizedPatientId = patientId && patientId.trim() !== '' ? patientId : null;

      console.log('OneSignal: Identifiers check:', {
        patientId: normalizedPatientId ? 'present' : 'null',
        userId: userId ? 'present' : 'null',
      });

      // We need at least one identifier - check AFTER getting userId
      if (!normalizedPatientId && !userId) {
        console.error('OneSignal: Cannot register - no patientId or userId available. User must be authenticated.');
        return false;
      }

      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          patient_id: normalizedPatientId,
          user_id: userId,
          clinic_id: clinicId,
          token: playerId,
          platform: 'web',
          is_active: true,
          device_info: {
            platform: 'web',
            isNative: false,
            userAgent: navigator.userAgent,
            type: 'onesignal-web'
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'clinic_id,token',
        });

      if (error) {
        console.error('OneSignal: Error registering token:', error);
        return false;
      }
      
      console.log('OneSignal: Token registered successfully');
      return true;
    } catch (err) {
      console.error('OneSignal: Exception registering token:', err);
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
      console.log('OneSignal: Current permission state:', currentPermission);
      
      if (currentPermission === 'denied') {
        toast.error('Notificações bloqueadas. Acesse as configurações do navegador para permitir.');
        setIsLoading(false);
        return false;
      }

      // Initialize OneSignal
      const initialized = await initializeOneSignal();
      if (!initialized) {
        toast.error('Erro ao inicializar serviço de notificações');
        setIsLoading(false);
        return false;
      }

      // Subscribe to push notifications
      console.log('OneSignal: Subscribing to notifications...');
      const playerId = await subscribeToNotifications();
      
      if (!playerId) {
        const permission = Notification.permission;
        if (permission === 'denied') {
          toast.error('Permissão negada. Habilite nas configurações do navegador.');
        } else {
          toast.error('Erro ao ativar notificações. Tente novamente.');
        }
        setIsLoading(false);
        return false;
      }

      // Set external user ID for targeting
      if (patientId) {
        await setExternalUserId(patientId);
      }

      // Add tags for segmentation
      await addTags({
        clinic_id: clinicId,
        ...(patientId && { patient_id: patientId }),
        platform: 'web',
      });

      // Register with backend
      const success = await registerToken(playerId);
      
      if (success) {
        setIsSubscribed(true);
        toast.success('Notificações ativadas com sucesso!');
      } else {
        toast.error('Erro ao salvar configuração de notificações');
      }

      setIsLoading(false);
      return success;
    } catch (error) {
      console.error('OneSignal: Error subscribing:', error);
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
          // If browser permission is not granted, we're not subscribed
          setIsSubscribed(false);
          return;
        }
        
        // Permission is granted, verify with OneSignal
        await initializeOneSignal();
        const oneSignalSubscribed = await checkIsSubscribed();
        console.log('Web Push: OneSignal subscription state:', oneSignalSubscribed);
        
        if (!oneSignalSubscribed) {
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
        const fullySubscribed = permission === 'granted' && oneSignalSubscribed && !!data;
        console.log('Web Push: Full subscription check:', { permission, oneSignalSubscribed, hasDbRecord: !!data, fullySubscribed });
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
