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

      // First, try to find existing record with same clinic_id and token
      const { data: existingByClinic } = await supabase
        .from('push_notification_tokens')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('token', deviceId)
        .maybeSingle();

      // Also check for existing record with same patient_id and token (if patient exists)
      let existingByPatient = null;
      if (normalizedPatientId) {
        const { data } = await supabase
          .from('push_notification_tokens')
          .select('id')
          .eq('patient_id', normalizedPatientId)
          .eq('token', deviceId)
          .maybeSingle();
        existingByPatient = data;
      }

      const existingId = existingByClinic?.id || existingByPatient?.id;

      const tokenData = {
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
      };

      let error;
      if (existingId) {
        // Update existing record
        const result = await supabase
          .from('push_notification_tokens')
          .update(tokenData)
          .eq('id', existingId);
        error = result.error;
      } else {
        // Insert new record
        const result = await supabase
          .from('push_notification_tokens')
          .insert(tokenData);
        error = result.error;
      }

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
      // STEP 1: Check current permission state
      const currentPermission = Notification.permission;
      console.log('[PUSH-ACTIVATION] Step 1 - Permission check:', currentPermission);
      
      if (currentPermission === 'denied') {
        console.error('[PUSH-ACTIVATION] BLOCKED: Permission denied by browser');
        toast.error('Notificações bloqueadas. Acesse as configurações do navegador para permitir.');
        setIsLoading(false);
        return false;
      }

      // STEP 1.5: Clear any stale local state before re-subscribing
      console.log('[PUSH-ACTIVATION] Step 1.5 - Clearing stale local state...');
      try {
        const { clearLocalState } = await import('@/lib/pusher-beams');
        await clearLocalState();
        console.log('[PUSH-ACTIVATION] Step 1.5 - Local state cleared');
      } catch (clearError) {
        console.warn('[PUSH-ACTIVATION] Could not clear local state:', clearError);
      }

      // STEP 2: Initialize Pusher Beams SDK
      console.log('[PUSH-ACTIVATION] Step 2 - Initializing Pusher Beams...');
      const initialized = await initializePusherBeams();
      console.log('[PUSH-ACTIVATION] Step 2 - Initialization result:', initialized);
      
      if (!initialized) {
        console.error('[PUSH-ACTIVATION] FAILED: Could not initialize Pusher Beams SDK');
        toast.error('Erro ao inicializar serviço de notificações');
        setIsLoading(false);
        return false;
      }

      // STEP 3: Subscribe to push notifications (triggers permission prompt if needed)
      console.log('[PUSH-ACTIVATION] Step 3 - Subscribing to notifications...');
      const deviceId = await subscribeToNotifications();
      console.log('[PUSH-ACTIVATION] Step 3 - Device ID result:', deviceId ? deviceId.substring(0, 20) + '...' : 'NULL');
      
      if (!deviceId) {
        const permission = Notification.permission;
        console.error('[PUSH-ACTIVATION] FAILED: No device ID returned. Permission:', permission);
        if (permission === 'denied') {
          toast.error('Permissão negada. Habilite nas configurações do navegador.');
        } else {
          toast.error('Erro ao ativar notificações. Tente novamente.');
        }
        setIsLoading(false);
        return false;
      }

      // STEP 4: Add device interests for targeting
      console.log('[PUSH-ACTIVATION] Step 4 - Adding interests...');
      if (clinicId) {
        console.log('[PUSH-ACTIVATION] Adding clinic interest:', `clinic-${clinicId}`);
        await addDeviceInterest(`clinic-${clinicId}`);
      }
      if (patientId) {
        console.log('[PUSH-ACTIVATION] Adding patient interest:', `patient-${patientId}`);
        await addDeviceInterest(`patient-${patientId}`);
      }

      // STEP 5: Register token with backend database
      console.log('[PUSH-ACTIVATION] Step 5 - Registering token with backend...');
      const success = await registerToken(deviceId);
      console.log('[PUSH-ACTIVATION] Step 5 - Registration result:', success);
      
      if (success) {
        setIsSubscribed(true);
        console.log('[PUSH-ACTIVATION] SUCCESS: Notifications fully activated');
        toast.success('Notificações ativadas com sucesso!');
      } else {
        console.error('[PUSH-ACTIVATION] FAILED: Could not save token to database');
        toast.error('Erro ao salvar configuração de notificações');
      }

      setIsLoading(false);
      return success;
    } catch (error) {
      console.error('[PUSH-ACTIVATION] EXCEPTION:', error);
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
        const initialized = await initializePusherBeams();
        if (!initialized) {
          console.warn('Web Push: Could not initialize Pusher Beams for check');
          setIsSubscribed(false);
          return;
        }
        
        const beamsSubscribed = await checkIsSubscribed();
        console.log('Web Push: Pusher Beams subscription state:', beamsSubscribed);
        
        if (!beamsSubscribed) {
          setIsSubscribed(false);
          return;
        }
        
        // Get current device ID
        const { getDeviceId } = await import('@/lib/pusher-beams');
        const deviceId = await getDeviceId();
        
        if (!deviceId) {
          console.log('Web Push: No device ID, subscription incomplete');
          setIsSubscribed(false);
          return;
        }
        
        // Finally check database for token registration with the CURRENT device ID
        const { data } = await supabase
          .from('push_notification_tokens')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('token', deviceId)
          .eq('platform', 'web')
          .eq('is_active', true)
          .maybeSingle();
        
        // Only considered subscribed if ALL checks pass
        const fullySubscribed = permission === 'granted' && beamsSubscribed && !!data;
        console.log('Web Push: Full subscription check:', { 
          permission, 
          beamsSubscribed, 
          deviceId: deviceId?.substring(0, 12) + '...',
          hasDbRecord: !!data, 
          fullySubscribed 
        });
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
