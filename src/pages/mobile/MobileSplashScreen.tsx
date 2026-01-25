/**
 * SPLASH SCREEN - PONTO ÚNICO DE DECISÃO DE AUTENTICAÇÃO
 * 
 * Esta é a ÚNICA tela autorizada a:
 * 1. Verificar sessão (getSession + onAuthStateChange)
 * 2. Decidir navegação (Home ou Login)
 * 3. Redirecionar usuário
 * 
 * NENHUMA outra tela pode executar essa lógica.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { restoreSession } from "@/hooks/useMobileSession";
import { Loader2 } from "lucide-react";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

export default function MobileSplashScreen() {
  const navigate = useNavigate();
  const hasDecided = useRef(false);
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);

  useEffect(() => {
    // Carregar logo da clínica para exibir no splash
    const loadClinicLogo = async () => {
      const { data } = await supabase
        .from("clinics")
        .select("logo_url")
        .eq("id", TARGET_CLINIC_ID)
        .single();
      
      if (data?.logo_url) {
        setClinicLogo(data.logo_url);
      }
    };
    loadClinicLogo();
  }, []);

  useEffect(() => {
    // Função única de decisão - só executa uma vez
    const decideNavigation = async () => {
      if (hasDecided.current) return;
      
      console.log("[SplashScreen] Iniciando verificação de sessão...");

      try {
        // 1. Tentar restaurar sessão Supabase JWT
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const metadata = session.user.user_metadata;
          const appMetadata = session.user.app_metadata;
          const patientId = metadata?.patient_id || appMetadata?.patient_id;
          
          if (patientId) {
            console.log("[SplashScreen] Sessão JWT válida encontrada, navegando para Home");
            hasDecided.current = true;
            navigate("/app/home", { replace: true });
            return;
          }
        }

        // 2. Fallback: verificar localStorage/IndexedDB
        const localSession = await restoreSession();
        
        if (localSession.isLoggedIn && localSession.patientId) {
          console.log("[SplashScreen] Sessão local válida encontrada, navegando para Home");
          hasDecided.current = true;
          navigate("/app/home", { replace: true });
          return;
        }

        // 3. Nenhuma sessão encontrada - navegar para Login
        console.log("[SplashScreen] Nenhuma sessão válida, navegando para Login");
        hasDecided.current = true;
        navigate("/app/login", { replace: true });

      } catch (error) {
        console.error("[SplashScreen] Erro ao verificar sessão:", error);
        // Em caso de erro, ir para Login como fallback seguro
        hasDecided.current = true;
        navigate("/app/login", { replace: true });
      }
    };

    // Executar verificação
    decideNavigation();
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
