import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SESSION_TOKEN_KEY = 'eclini_session_token';

function generateSessionToken(): string {
  return crypto.randomUUID() + '-' + Date.now();
}

export function useSessionControl() {
  const { user, currentClinic, signOut } = useAuth();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // Register session on login
  const registerSession = useCallback(async (clinicId?: string) => {
    if (!user?.id) return;
    const cId = clinicId || currentClinic?.id;
    if (!cId) return;

    const token = generateSessionToken();
    sessionTokenRef.current = token;
    localStorage.setItem(SESSION_TOKEN_KEY, token);

    // Check clinic policy
    const { data: clinic } = await supabase
      .from('clinics')
      .select('allow_multiple_sessions')
      .eq('id', cId)
      .single();

    if (clinic && !clinic.allow_multiple_sessions) {
      // Invalidate previous sessions
      await supabase.rpc('invalidate_previous_sessions', {
        p_user_id: user.id,
        p_clinic_id: cId,
        p_current_session_token: token,
      });
    }

    // Register this session
    await supabase.from('user_active_sessions').insert({
      user_id: user.id,
      clinic_id: cId,
      session_token: token,
      device_info: navigator.userAgent.substring(0, 200),
    });
  }, [user?.id, currentClinic?.id]);

  // Check if current session is still valid
  const checkSessionValidity = useCallback(async () => {
    const token = sessionTokenRef.current || localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token || !user?.id) return;

    const { data } = await supabase
      .rpc('is_session_valid', { p_session_token: token });

    if (data === false) {
      // Session was invalidated (another login happened)
      localStorage.removeItem(SESSION_TOKEN_KEY);
      sessionTokenRef.current = null;
      
      // Sign out
      await signOut();
      
      // Show message after redirect
      setTimeout(() => {
        alert('Sua sessão foi encerrada porque um novo login foi realizado em outro dispositivo.');
      }, 500);
    }
  }, [user?.id, signOut]);

  // Mark session as inactive on logout
  const deactivateSession = useCallback(async () => {
    const token = sessionTokenRef.current || localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return;

    await supabase
      .from('user_active_sessions')
      .update({ is_active: false, invalidated_at: new Date().toISOString(), invalidated_reason: 'logout' })
      .eq('session_token', token);

    localStorage.removeItem(SESSION_TOKEN_KEY);
    sessionTokenRef.current = null;
  }, []);

  // Start polling to check session validity
  useEffect(() => {
    if (!user?.id || !currentClinic?.id) return;

    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    if (token) {
      sessionTokenRef.current = token;
    }

    // Check every 30 seconds
    pollingRef.current = setInterval(checkSessionValidity, 30000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [user?.id, currentClinic?.id, checkSessionValidity]);

  return {
    registerSession,
    deactivateSession,
    checkSessionValidity,
  };
}
