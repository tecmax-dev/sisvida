/**
 * SISTEMA DE AUTENTICAÇÃO MÓVEL COM SESSÃO JWT PERSISTENTE
 * 
 * Este hook gerencia autenticação de pacientes no app mobile usando:
 * 1. Verificação customizada de senha via RPC (verify_patient_password)
 * 2. Sessão JWT real do Supabase (para persistência robusta)
 * 3. Backup em localStorage/IndexedDB (redundância)
 * 
 * A sessão JWT do Supabase é automaticamente renovada pelo autoRefreshToken,
 * garantindo que o usuário permaneça logado indefinidamente até logout manual.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { persistSession, restoreSession, clearSession } from "./useMobileSession";

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
 * Combina autenticação customizada com sessão JWT do Supabase
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

  /**
   * Inicialização: tenta restaurar sessão existente
   * Prioridade: Supabase JWT > localStorage > IndexedDB
   */
  const initialize = useCallback(async () => {
    console.log("[MobileAuth] Inicializando...");
    
    try {
      // 1. Verificar sessão Supabase (mais confiável - tem refresh token)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Extrair dados do paciente da metadata do usuário
        const metadata = session.user.user_metadata;
        const appMetadata = session.user.app_metadata;
        
        const patientId = metadata?.patient_id || appMetadata?.patient_id;
        const clinicId = metadata?.clinic_id || appMetadata?.clinic_id || TARGET_CLINIC_ID;
        const patientName = metadata?.name || session.user.email?.split('@')[0] || 'Paciente';
        
        if (patientId) {
          console.log("[MobileAuth] Sessão Supabase restaurada:", patientName);
          
          // Sincronizar com localStorage/IndexedDB
          await persistSession(patientId, clinicId, patientName);
          
          setState({
            isLoggedIn: true,
            patientId,
            clinicId,
            patientName,
            loading: false,
            initialized: true,
          });
          return;
        }
      }
      
      // 2. Fallback: restaurar de localStorage/IndexedDB
      const localSession = await restoreSession();
      
      if (localSession.isLoggedIn && localSession.patientId) {
        console.log("[MobileAuth] Sessão local restaurada:", localSession.patientName);
        
        setState({
          isLoggedIn: true,
          patientId: localSession.patientId,
          clinicId: localSession.clinicId,
          patientName: localSession.patientName,
          loading: false,
          initialized: true,
        });
        return;
      }
      
      // 3. Nenhuma sessão encontrada
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
      console.error("[MobileAuth] Erro na inicialização:", err);
      setState(prev => ({ ...prev, loading: false, initialized: true }));
    }
  }, []);

  /**
   * Login: verifica senha customizada e cria sessão JWT do Supabase
   */
  const login = useCallback(async (cpf: string, password: string): Promise<LoginResult> => {
    console.log("[MobileAuth] Iniciando login...");
    
    try {
      const normalizedCpf = cpf.replace(/\D/g, '');
      
      // 1. Verificar credenciais via RPC customizado
      const { data: patientData, error: verifyError } = await supabase
        .rpc('verify_patient_password', {
          p_cpf: normalizedCpf,
          p_password: password
        });

      if (verifyError || !patientData || patientData.length === 0) {
        console.error("[MobileAuth] Credenciais inválidas:", verifyError);
        return { 
          success: false, 
          error: "CPF ou senha incorretos. Verifique seus dados." 
        };
      }

      // Selecionar paciente da clínica alvo
      const patient = patientData.find((p: any) => p.clinic_id === TARGET_CLINIC_ID) ?? patientData[0];
      
      console.log("[MobileAuth] Paciente encontrado:", patient.patient_name);

      if (!patient?.is_active) {
        return { 
          success: false, 
          error: "Sua conta está inativa. Entre em contato com o sindicato." 
        };
      }

      // 2. Gerar email único para sessão Supabase
      const email = patient.patient_email && patient.patient_email !== '' 
        ? patient.patient_email 
        : `paciente_${normalizedCpf}@app.internal`;
      
      // 3. Tentar login no Supabase (cria sessão JWT)
      let authSuccess = false;
      
      // Primeiro tentar signIn (usuário já existe)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (!signInError) {
        authSuccess = true;
        console.log("[MobileAuth] Login Supabase bem sucedido");
      } else if (signInError.message.includes('Invalid login credentials')) {
        // Usuário não existe ou senha diferente - tentar signUp
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: patient.patient_name,
              patient_id: patient.patient_id,
              clinic_id: patient.clinic_id,
            },
          },
        });
        
        if (!signUpError) {
          // Após signup, fazer login
          const { error: loginAfterSignup } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          authSuccess = !loginAfterSignup;
          console.log("[MobileAuth] SignUp + Login:", authSuccess);
        }
      }
      
      // 4. Persistir em localStorage/IndexedDB (backup)
      await persistSession(patient.patient_id, patient.clinic_id, patient.patient_name);
      
      // 5. Atualizar estado
      setState({
        isLoggedIn: true,
        patientId: patient.patient_id,
        clinicId: patient.clinic_id,
        patientName: patient.patient_name,
        loading: false,
        initialized: true,
      });
      
      console.log("[MobileAuth] Login completo:", {
        supabaseAuth: authSuccess,
        localPersistence: true,
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
        error: "Ocorreu um erro ao fazer login. Tente novamente." 
      };
    }
  }, []);

  /**
   * Logout: limpa todas as sessões (Supabase + local)
   */
  const logout = useCallback(async () => {
    console.log("[MobileAuth] Executando logout...");
    
    try {
      // 1. Logout do Supabase (limpa JWT)
      await supabase.auth.signOut({ scope: 'local' });
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
    
    console.log("[MobileAuth] Logout completo");
  }, []);

  /**
   * Verificar sessão: revalida se a sessão ainda é válida
   */
  const verifySession = useCallback(async (): Promise<boolean> => {
    // Se já está logado localmente, confiar
    if (state.isLoggedIn && state.patientId) {
      return true;
    }
    
    // Tentar restaurar
    await initialize();
    return state.isLoggedIn;
  }, [state.isLoggedIn, state.patientId, initialize]);

  // Inicializar ao montar
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Escutar mudanças de autenticação do Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[MobileAuth] Auth state change:", event);
        
        if (event === 'SIGNED_OUT') {
          // Logout detectado - limpar tudo
          await clearSession();
          setState({
            isLoggedIn: false,
            patientId: null,
            clinicId: null,
            patientName: null,
            loading: false,
            initialized: true,
          });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Token renovado - manter sessão
          console.log("[MobileAuth] Token renovado automaticamente");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    ...state,
    login,
    logout,
    verifySession,
    refresh: initialize,
  };
}
