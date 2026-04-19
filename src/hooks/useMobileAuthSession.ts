/**
 * SISTEMA DE AUTENTICAÇÃO MÓVEL - Arquitetura Bootstrap Imperativo
 * 
 * Este hook apenas CONSOME e DISPONIBILIZA os dados de sessão já validados.
 * A verificação de sessão acontece ANTES do React no bootstrap imperativo.
 * 
 * ❌ PROIBIDO: supabase.auth.getSession(), restoreSession(), navigate("/app/login")
 * ✅ PERMITIDO: onAuthStateChange para manter estado sincronizado
 * 
 * GARANTIAS:
 * 1. NÃO decide autenticação (bootstrap já decidiu)
 * 2. NÃO redireciona (páginas mostram estado vazio se sem dados)
 * 3. Apenas reage a eventos de auth para manter estado atualizado
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { persistSession, clearSession, restoreSession } from "./useMobileSession";
import { getBootstrapResult } from "@/mobileBootstrap";

interface MobileAuthState {
  isLoggedIn: boolean;
  patientId: string | null;
  clinicId: string | null;
  patientName: string | null;
  loading: boolean;
  initialized: boolean;
}

interface LoginResult {
  success: boolean;
  error?: string;
  patientId?: string;
  patientName?: string;
  clinicId?: string;
}

// Target clinic for this mobile app
const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

/**
 * Hook principal de autenticação mobile
 * 
 * IMPORTANTE: Este hook NÃO verifica sessão ativamente.
 * O bootstrap imperativo já fez isso ANTES do React montar.
 * 
 * Este hook apenas:
 * 1. Lê dados do localStorage (já validados pelo bootstrap)
 * 2. Escuta onAuthStateChange para manter sincronizado
 * 3. Fornece funções de login/logout
 */
export function useMobileAuthSession() {
  const [state, setState] = useState<MobileAuthState>({
    isLoggedIn: false,
    patientId: null,
    clinicId: null,
    patientName: null,
    loading: true,
    initialized: false,
  });

  // Ref para evitar múltiplas inicializações
  const initializationDone = useRef(false);

  /**
   * Verifica se a sessão foi invalidada pelo admin (force logout)
   */
  const checkForceLogout = useCallback(async (clinicId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('mobile_app_settings')
        .select('force_logout_after')
        .eq('clinic_id', clinicId)
        .maybeSingle();
      
      if (error || !data?.force_logout_after) {
        return false; // Sem configuração = não forçar logout
      }
      
      // Verificar se a sessão local foi criada antes do force_logout_after
      const lastLoginStr = localStorage.getItem('mobile_session_created_at');
      if (!lastLoginStr) {
        // Sessão antiga sem timestamp = forçar logout
        console.warn("[MobileAuth] Sessão sem timestamp, forçando logout");
        return true;
      }
      
      const lastLogin = new Date(lastLoginStr);
      const forceAfter = new Date(data.force_logout_after);
      
      if (lastLogin < forceAfter) {
        console.warn("[MobileAuth] Sessão invalidada pelo admin (force_logout_after)");
        return true;
      }
      
      return false;
    } catch (err) {
      console.error("[MobileAuth] Erro ao verificar force_logout:", err);
      return false;
    }
  }, []);

  /**
   * Inicialização: Apenas lê dados do localStorage
   * NÃO faz verificação ativa de sessão (bootstrap já fez)
   */
  const initialize = useCallback(() => {
    if (initializationDone.current) return;
    initializationDone.current = true;
    
    console.log("[MobileAuth] Inicializando...");
    
    (async () => {
      try {
        // OTIMIZAÇÃO: Usar resultado do bootstrap se disponível (evita restoreSession duplicado)
        const bootstrapData = getBootstrapResult();
        
        let patientId: string | null = null;
        let clinicId: string | null = null;
        let patientName: string | null = null;

        if (bootstrapData?.isAuthenticated && bootstrapData.patientId) {
          // Bootstrap já validou - usar diretamente
          patientId = bootstrapData.patientId;
          clinicId = bootstrapData.clinicId;
          patientName = bootstrapData.patientName;
          console.log("[MobileAuth] Usando dados do bootstrap:", patientName);
        } else {
          // Fallback: restaurar de storage (caso bootstrap não executou)
          const restored = await restoreSession();
          patientId = restored.patientId;
          clinicId = restored.clinicId;
          patientName = restored.patientName;
        }

        if (patientId) {
          // Verificar se sessão foi invalidada pelo admin
          const shouldForceLogout = await checkForceLogout(clinicId || TARGET_CLINIC_ID);
          
          if (shouldForceLogout) {
            console.warn("[MobileAuth] Forçando logout por invalidação de sessão");
            await clearSession();
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch {}
            setState({
              isLoggedIn: false,
              patientId: null,
              clinicId: null,
              patientName: null,
              loading: false,
              initialized: true,
            });
            return;
          }

          console.log("[MobileAuth] Sessão restaurada:", patientName);
          setState({
            isLoggedIn: true,
            patientId,
            clinicId: clinicId || TARGET_CLINIC_ID,
            patientName,
            loading: false,
            initialized: true,
          });
          return;
        }

        // Fallback: recuperar do auth backend se storage local vazio
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.warn("[MobileAuth] getUser() falhou:", error);
        }

        const user = data?.user;
        const appMeta = (user?.app_metadata ?? {}) as Record<string, any>;
        const userMeta = (user?.user_metadata ?? {}) as Record<string, any>;

        const patientIdFromMeta: string | null =
          (appMeta.patient_id as string | undefined) ??
          (userMeta.patient_id as string | undefined) ??
          null;

        const clinicIdFromMeta: string | null =
          (appMeta.clinic_id as string | undefined) ??
          (userMeta.clinic_id as string | undefined) ??
          null;

        const nameFromMeta: string | null =
          (userMeta.name as string | undefined) ??
          null;

        if (patientIdFromMeta) {
          const shouldForceLogout = await checkForceLogout(clinicIdFromMeta || TARGET_CLINIC_ID);
          
          if (shouldForceLogout) {
            console.warn("[MobileAuth] Forçando logout por invalidação de sessão (metadata)");
            await clearSession();
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch {}
            setState({
              isLoggedIn: false,
              patientId: null,
              clinicId: null,
              patientName: null,
              loading: false,
              initialized: true,
            });
            return;
          }
          
          console.log("[MobileAuth] Sessão recuperada do usuário autenticado");
          await persistSession(patientIdFromMeta, clinicIdFromMeta || TARGET_CLINIC_ID, nameFromMeta || "Paciente");
          setState({
            isLoggedIn: true,
            patientId: patientIdFromMeta,
            clinicId: clinicIdFromMeta || TARGET_CLINIC_ID,
            patientName: nameFromMeta,
            loading: false,
            initialized: true,
          });
          return;
        }

        console.log("[MobileAuth] Nenhuma sessão encontrada");
        setState({
          isLoggedIn: false,
          patientId: null,
          clinicId: null,
          patientName: null,
          loading: false,
          initialized: true,
        });
      } catch (err) {
        console.error("[MobileAuth] Erro ao inicializar sessão:", err);
        setState({
          isLoggedIn: false,
          patientId: null,
          clinicId: null,
          patientName: null,
          loading: false,
          initialized: true,
        });
      }
    })();
  }, [checkForceLogout]);

  /**
   * Login: verifica senha customizada e cria sessão JWT do Supabase
   * Este é o ÚNICO local onde podemos fazer verificações ativas
   */
  const login = useCallback(async (cpf: string, password: string): Promise<LoginResult> => {
    console.log("[MobileAuth] Iniciando login...");

    try {
      const normalizedCpf = cpf.replace(/\D/g, '');

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (signOutError) {
        console.warn("[MobileAuth] Não foi possível limpar sessão anterior antes do login:", signOutError);
      }

      const { data: authBootstrap, error: authBootstrapError } = await supabase.functions.invoke(
        'mobile-patient-auth',
        {
          body: {
            cpf: normalizedCpf,
            password,
            clinic_id: TARGET_CLINIC_ID,
          },
        }
      );

      if (authBootstrapError) {
        console.error('[MobileAuth] mobile-patient-auth falhou:', authBootstrapError);
        await clearSession();
        return {
          success: false,
          error: 'Não foi possível preparar sua conta de acesso. Tente novamente.',
        };
      }

      if (!authBootstrap?.success) {
        return {
          success: false,
          error: authBootstrap?.error || 'CPF ou senha incorretos. Verifique seus dados.',
        };
      }

      const patient = {
        patient_id: authBootstrap.patient_id as string,
        patient_name: authBootstrap.patient_name as string,
        clinic_id: authBootstrap.clinic_id as string,
        patient_email: authBootstrap.patient_email as string,
      };

      if (!authBootstrap?.access_token || !authBootstrap?.refresh_token) {
        console.error('[MobileAuth] mobile-patient-auth retornou sucesso sem tokens de sessão', authBootstrap);
        await clearSession();
        return {
          success: false,
          error: 'Não foi possível iniciar sua sessão no app. Tente novamente.',
        };
      }

      const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
        access_token: authBootstrap.access_token as string,
        refresh_token: authBootstrap.refresh_token as string,
      });

      if (setSessionError || !setSessionData.session) {
        console.error('[MobileAuth] setSession falhou após bootstrap', setSessionError);
        await clearSession();
        return {
          success: false,
          error: 'Não foi possível validar sua sessão de acesso. Entre novamente.',
        };
      }

      console.log('[MobileAuth] Sessão restaurada a partir do backend', {
        authUserId: setSessionData.session.user.id,
        patientId: patient.patient_id,
      });

      await persistSession(patient.patient_id, patient.clinic_id, patient.patient_name);

      setState({
        isLoggedIn: true,
        patientId: patient.patient_id,
        clinicId: patient.clinic_id,
        patientName: patient.patient_name,
        loading: false,
        initialized: true,
      });

      console.log('[MobileAuth] Login completo:', {
        supabaseAuth: true,
        localPersistence: true,
        authUserId: setSessionData.session.user.id,
      });

      return {
        success: true,
        patientId: patient.patient_id,
        patientName: patient.patient_name,
        clinicId: patient.clinic_id,
      };
    } catch (err) {
      console.error("[MobileAuth] Erro no login:", err);
      return {
        success: false,
        error: 'Ocorreu um erro ao fazer login. Tente novamente.',
      };
    }
  }, []);

  /**
   * Logout: limpa todas as sessões (Supabase + local)
   * INSTRUMENTADO: Log detalhado para auditoria
   */
  const logout = useCallback(async () => {
    // AUDITORIA: Logar TODA chamada de logout com stack trace
    const stack = new Error().stack;
    console.warn("[MobileAuth] LOGOUT CHAMADO", {
      timestamp: new Date().toISOString(),
      currentState: { isLoggedIn: state.isLoggedIn, patientId: state.patientId },
      stack: stack?.split('\n').slice(1, 6).join('\n'),
    });
    
    try {
      // 1. Logout do Supabase (limpa JWT)
      await supabase.auth.signOut({ scope: 'local' });
      console.warn("[MobileAuth] supabase.auth.signOut() executado");
    } catch (err) {
      console.warn("[MobileAuth] Erro no signOut Supabase:", err);
    }
    
    // 2. Limpar localStorage/IndexedDB
    await clearSession();
    
    // 3. Limpar estado
    setState({
      isLoggedIn: false,
      patientId: null,
      clinicId: null,
      patientName: null,
      loading: false,
      initialized: true,
    });
    
    console.warn("[MobileAuth] Logout COMPLETO - sessão destruída");
  }, [state.isLoggedIn, state.patientId]);

  /**
   * Verificar sessão: apenas retorna o estado atual
   * NÃO faz verificação ativa (bootstrap já fez)
   */
  const verifySession = useCallback(async (): Promise<boolean> => {
    return state.isLoggedIn && !!state.patientId;
  }, [state.isLoggedIn, state.patientId]);

  // Inicializar ao montar (leitura passiva do localStorage)
  useEffect(() => {
    initialize();
  }, [initialize]);

  // REMOVIDO: onAuthStateChange
  // App mobile usa autenticação customizada (localStorage/IndexedDB), não Supabase Auth.
  // Manter onAuthStateChange causava logout involuntário ao navegar entre abas,
  // pois eventos SIGNED_OUT destruíam a sessão local mesmo sem logout real do usuário.

  return {
    ...state,
    login,
    logout,
    verifySession,
    refresh: initialize,
  };
}
