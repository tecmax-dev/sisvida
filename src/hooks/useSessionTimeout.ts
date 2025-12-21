import { useEffect, useRef, useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SessionTimeoutOptions {
  maxSessionDuration?: number; // Tempo máximo de sessão (em minutos)
  inactivityTimeout?: number;  // Tempo de inatividade para logout (em minutos)
  warningTime?: number;        // Tempo antes do logout para mostrar aviso (em minutos)
  onExpire: () => void;        // Callback quando a sessão expira
  onWarning?: () => void;      // Callback quando deve mostrar aviso
  enabled?: boolean;           // Se o timeout está ativo
}

const SESSION_LOGIN_TIME_KEY = 'eclini_session_login_time';
const LAST_ACTIVITY_KEY = 'eclini_last_activity';

export function useSessionTimeout(options: SessionTimeoutOptions) {
  const {
    maxSessionDuration = 480,  // 8 horas padrão (em minutos)
    inactivityTimeout = 30,    // 30 minutos de inatividade
    warningTime = 5,           // Aviso 5 minutos antes
    onExpire,
    onWarning,
    enabled = true
  } = options;

  const { toast } = useToast();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Salvar timestamp de login
  const saveLoginTime = useCallback(() => {
    localStorage.setItem(SESSION_LOGIN_TIME_KEY, Date.now().toString());
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  // Limpar timestamps
  const clearSessionData = useCallback(() => {
    localStorage.removeItem(SESSION_LOGIN_TIME_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  }, []);

  // Atualizar última atividade
  const updateLastActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    warningShownRef.current = false;
    setShowWarning(false);
  }, []);

  // Renovar sessão (resetar todos os timers)
  const renewSession = useCallback(() => {
    localStorage.setItem(SESSION_LOGIN_TIME_KEY, Date.now().toString());
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    warningShownRef.current = false;
    setShowWarning(false);
    toast({
      title: "Sessão renovada",
      description: "Sua sessão foi estendida com sucesso.",
    });
  }, [toast]);

  // Verificar expiração
  const checkExpiry = useCallback(() => {
    if (!enabled) return;

    const loginTime = localStorage.getItem(SESSION_LOGIN_TIME_KEY);
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    const now = Date.now();

    if (!loginTime) return;

    const loginTimeMs = parseInt(loginTime);
    const lastActivityMs = lastActivity ? parseInt(lastActivity) : now;

    // Verificar tempo máximo de sessão
    const sessionDurationMs = maxSessionDuration * 60 * 1000;
    const timeSinceLogin = now - loginTimeMs;
    const timeUntilMaxExpiry = sessionDurationMs - timeSinceLogin;

    // Verificar inatividade
    const inactivityMs = inactivityTimeout * 60 * 1000;
    const timeSinceActivity = now - lastActivityMs;
    const timeUntilInactivityExpiry = inactivityMs - timeSinceActivity;

    // Pegar o menor tempo até expirar
    const timeUntilExpiry = Math.min(timeUntilMaxExpiry, timeUntilInactivityExpiry);
    const warningTimeMs = warningTime * 60 * 1000;

    // Atualizar tempo restante
    setTimeRemaining(Math.max(0, Math.floor(timeUntilExpiry / 1000)));

    // Sessão expirada
    if (timeUntilExpiry <= 0) {
      clearSessionData();
      setShowWarning(false);
      onExpire();
      toast({
        title: "Sessão expirada",
        description: "Por segurança, você foi desconectado.",
        variant: "destructive",
      });
      return;
    }

    // Mostrar aviso
    if (timeUntilExpiry <= warningTimeMs && !warningShownRef.current) {
      warningShownRef.current = true;
      setShowWarning(true);
      onWarning?.();
    }
  }, [enabled, maxSessionDuration, inactivityTimeout, warningTime, onExpire, onWarning, clearSessionData, toast]);

  // Configurar detector de atividade
  useEffect(() => {
    if (!enabled) return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateLastActivity();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, updateLastActivity]);

  // Configurar verificação periódica
  useEffect(() => {
    if (!enabled) return;

    // Verificar a cada 30 segundos
    checkIntervalRef.current = setInterval(checkExpiry, 30000);
    
    // Verificar imediatamente ao montar
    checkExpiry();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, checkExpiry]);

  return {
    saveLoginTime,
    clearSessionData,
    renewSession,
    showWarning,
    timeRemaining,
    dismissWarning: () => setShowWarning(false)
  };
}
