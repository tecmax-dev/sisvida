/**
 * BOOTSTRAP IMPERATIVO PARA APP MOBILE
 * 
 * Este arquivo é executado ANTES do React renderizar.
 * Decide a rota inicial baseado na sessão existente.
 * 
 * GARANTIAS:
 * 1. Executa uma única vez, antes do React
 * 2. Decisão síncrona após verificação
 * 3. Não depende de useState, useEffect ou contextos
 * 4. Timeout obrigatório de 3 segundos
 */

import { supabase } from "@/integrations/supabase/client";
import { restoreSession } from "@/hooks/useMobileSession";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const BOOTSTRAP_TIMEOUT = 3000; // 3 segundos máximo

export interface BootstrapResult {
  initialRoute: "/app/home" | "/app/login";
  isAuthenticated: boolean;
  patientId: string | null;
  patientName: string | null;
  clinicId: string | null;
}

// Cache do resultado do bootstrap para evitar re-execução
let bootstrapResult: BootstrapResult | null = null;
let bootstrapPromise: Promise<BootstrapResult> | null = null;

/**
 * Executa verificação de sessão de forma imperativa
 * Retorna a rota inicial que deve ser usada
 */
async function checkSession(): Promise<BootstrapResult> {
  console.log("[MobileBootstrap] Verificando sessão...");
  
  try {
    // 1. Verificar sessão JWT do Supabase
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!error && session?.user) {
      const metadata = session.user.user_metadata;
      const appMetadata = session.user.app_metadata;
      const patientId = metadata?.patient_id || appMetadata?.patient_id;
      
      if (patientId) {
        console.log("[MobileBootstrap] Sessão JWT válida:", metadata?.name);
        return {
          initialRoute: "/app/home",
          isAuthenticated: true,
          patientId,
          patientName: metadata?.name || session.user.email?.split('@')[0] || 'Paciente',
          clinicId: metadata?.clinic_id || appMetadata?.clinic_id || TARGET_CLINIC_ID,
        };
      }
    }
    
    // 2. Fallback: verificar localStorage/IndexedDB
    const localSession = await restoreSession();
    
    if (localSession.isLoggedIn && localSession.patientId) {
      console.log("[MobileBootstrap] Sessão local válida:", localSession.patientName);
      return {
        initialRoute: "/app/home",
        isAuthenticated: true,
        patientId: localSession.patientId,
        patientName: localSession.patientName,
        clinicId: localSession.clinicId,
      };
    }
    
    // 3. Nenhuma sessão encontrada
    console.log("[MobileBootstrap] Nenhuma sessão encontrada");
    return {
      initialRoute: "/app/login",
      isAuthenticated: false,
      patientId: null,
      patientName: null,
      clinicId: null,
    };
    
  } catch (err) {
    console.error("[MobileBootstrap] Erro na verificação:", err);
    // Em caso de erro, ir para login como fallback seguro
    return {
      initialRoute: "/app/login",
      isAuthenticated: false,
      patientId: null,
      patientName: null,
      clinicId: null,
    };
  }
}

/**
 * Bootstrap principal - executa verificação com timeout obrigatório
 * Garante que SEMPRE retorna um resultado em no máximo 3 segundos
 */
export async function mobileBootstrap(): Promise<BootstrapResult> {
  // Se já temos resultado, retornar imediatamente
  if (bootstrapResult) {
    console.log("[MobileBootstrap] Usando resultado em cache");
    return bootstrapResult;
  }
  
  // Se já está em execução, aguardar a promise existente
  if (bootstrapPromise) {
    console.log("[MobileBootstrap] Aguardando bootstrap em andamento");
    return bootstrapPromise;
  }
  
  console.log("[MobileBootstrap] Iniciando bootstrap...");
  
  // Criar promise com timeout obrigatório
  bootstrapPromise = new Promise<BootstrapResult>((resolve) => {
    // Timeout de segurança - SEMPRE resolve após 3 segundos
    const timeoutId = setTimeout(() => {
      console.warn("[MobileBootstrap] TIMEOUT - forçando navegação para login");
      const fallback: BootstrapResult = {
        initialRoute: "/app/login",
        isAuthenticated: false,
        patientId: null,
        patientName: null,
        clinicId: null,
      };
      bootstrapResult = fallback;
      resolve(fallback);
    }, BOOTSTRAP_TIMEOUT);
    
    // Verificação real
    checkSession().then((result) => {
      clearTimeout(timeoutId);
      bootstrapResult = result;
      resolve(result);
    }).catch(() => {
      clearTimeout(timeoutId);
      const fallback: BootstrapResult = {
        initialRoute: "/app/login",
        isAuthenticated: false,
        patientId: null,
        patientName: null,
        clinicId: null,
      };
      bootstrapResult = fallback;
      resolve(fallback);
    });
  });
  
  return bootstrapPromise;
}

/**
 * Retorna o resultado do bootstrap se já foi executado
 * Retorna null se o bootstrap ainda não foi executado
 */
export function getBootstrapResult(): BootstrapResult | null {
  return bootstrapResult;
}

/**
 * Limpa o cache do bootstrap (usado no logout)
 * INSTRUMENTADO: Log de auditoria
 */
export function clearBootstrapCache(): void {
  const stack = new Error().stack;
  console.warn("[MobileBootstrap] clearBootstrapCache() CHAMADO", {
    timestamp: new Date().toISOString(),
    previousResult: bootstrapResult,
    stack: stack?.split('\n').slice(1, 4).join('\n'),
  });
  
  bootstrapResult = null;
  bootstrapPromise = null;
  console.warn("[MobileBootstrap] Cache LIMPO");
}
