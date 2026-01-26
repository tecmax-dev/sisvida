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
import { persistSession, clearSession, STORAGE_KEYS } from "./useMobileSession";

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
   * Inicialização: Apenas lê dados do localStorage
   * NÃO faz verificação ativa de sessão (bootstrap já fez)
   */
  const initialize = useCallback(() => {
    if (initializationDone.current) return;
    initializationDone.current = true;
    
    console.log("[MobileAuth] Inicializando a partir do localStorage...");
    
    try {
      // Apenas ler dados que o bootstrap já validou e persistiu
      const patientId = localStorage.getItem(STORAGE_KEYS.patientId);
      const clinicId = localStorage.getItem(STORAGE_KEYS.clinicId);
      const patientName = localStorage.getItem(STORAGE_KEYS.patientName);
      
      if (patientId) {
        console.log("[MobileAuth] Dados encontrados:", patientName);
        setState({
          isLoggedIn: true,
          patientId,
          clinicId: clinicId || TARGET_CLINIC_ID,
          patientName,
          loading: false,
          initialized: true,
        });
      } else {
        console.log("[MobileAuth] Nenhum dado no localStorage");
        setState({
          isLoggedIn: false,
          patientId: null,
          clinicId: null,
          patientName: null,
          loading: false,
          initialized: true,
        });
      }
    } catch (err) {
      console.error("[MobileAuth] Erro ao ler localStorage:", err);
      setState({
        isLoggedIn: false,
        patientId: null,
        clinicId: null,
        patientName: null,
        loading: false,
        initialized: true,
      });
    }
  }, []);

  /**
   * Login: verifica senha customizada e cria sessão JWT do Supabase
   * Este é o ÚNICO local onde podemos fazer verificações ativas
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
