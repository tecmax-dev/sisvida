/**
 * SPLASH SCREEN - PONTO ÚNICO DE DECISÃO DE AUTENTICAÇÃO
 * 
 * GARANTIAS:
 * 1. Sempre finaliza o loading (timeout de 5s como fallback)
 * 2. Navega apenas UMA vez
 * 3. Não depende de onAuthStateChange para decisão inicial
 * 4. getSession() é chamado uma única vez
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { restoreSession } from "@/hooks/useMobileSession";
import { Loader2 } from "lucide-react";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const MAX_INIT_TIMEOUT = 5000; // 5 segundos máximo

export default function MobileSplashScreen() {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const initStarted = useRef(false);
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);

  // Função de navegação única - só executa uma vez
  const navigateTo = (path: string) => {
    if (hasNavigated.current) {
      console.log("[SplashScreen] Navegação já realizada, ignorando:", path);
      return;
    }
    hasNavigated.current = true;
    console.log("[SplashScreen] Navegando para:", path);
    navigate(path, { replace: true });
  };

  useEffect(() => {
    // Prevenir execução dupla
    if (initStarted.current) return;
    initStarted.current = true;

    console.log("[SplashScreen] Iniciando verificação de sessão...");

    // Carregar logo da clínica (não bloqueia navegação)
    supabase
      .from("clinics")
      .select("logo_url")
      .eq("id", TARGET_CLINIC_ID)
      .single()
      .then(({ data }) => {
        if (data?.logo_url) setClinicLogo(data.logo_url);
      });

    // Timeout de segurança - SEMPRE finaliza após 5s
    const timeoutId = setTimeout(() => {
      if (!hasNavigated.current) {
        console.warn("[SplashScreen] TIMEOUT: Forçando navegação para login");
        navigateTo("/app/login");
      }
    }, MAX_INIT_TIMEOUT);

    // Função principal de decisão
    const decideNavigation = async () => {
      try {
        // 1. Verificar sessão Supabase JWT (única chamada)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[SplashScreen] Erro ao obter sessão:", sessionError);
          // Continuar para fallback local
        }

        if (session?.user) {
          const metadata = session.user.user_metadata;
          const appMetadata = session.user.app_metadata;
          const patientId = metadata?.patient_id || appMetadata?.patient_id;
          
          if (patientId) {
            console.log("[SplashScreen] Sessão JWT válida, patient_id:", patientId);
            clearTimeout(timeoutId);
            navigateTo("/app/home");
            return;
          }
          console.log("[SplashScreen] Sessão JWT sem patient_id, verificando local...");
        }

        // 2. Fallback: verificar localStorage/IndexedDB
        const localSession = await restoreSession();
        
        if (localSession.isLoggedIn && localSession.patientId) {
          console.log("[SplashScreen] Sessão local válida:", localSession.patientName);
          clearTimeout(timeoutId);
          navigateTo("/app/home");
          return;
        }

        // 3. Nenhuma sessão encontrada
        console.log("[SplashScreen] Nenhuma sessão válida encontrada");
        clearTimeout(timeoutId);
        navigateTo("/app/login");

      } catch (error) {
        console.error("[SplashScreen] Erro durante verificação:", error);
        clearTimeout(timeoutId);
        // Em caso de erro, ir para login como fallback seguro
        navigateTo("/app/login");
      }
    };

    // Executar verificação imediatamente
    decideNavigation();

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  // Renderizar splash enquanto verifica sessão
  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center">
      {/* Logo Container */}
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg">
        {clinicLogo ? (
          <img 
            src={clinicLogo} 
            alt="Logo" 
            className="w-16 h-16 object-contain"
          />
        ) : (
          <div className="w-16 h-16 bg-emerald-100 rounded-full animate-pulse" />
        )}
      </div>
      
      {/* Loading Indicator */}
      <Loader2 className="h-8 w-8 animate-spin text-white mb-4" />
      
      {/* Loading Text */}
      <p className="text-white/80 text-sm font-medium">
        Carregando...
      </p>
    </div>
  );
}
