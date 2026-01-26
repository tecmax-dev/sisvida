import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

/**
 * Hook para rastrear instalações do PWA.
 * Registra quando o usuário instala o app via beforeinstallprompt ou 
 * quando detecta que está rodando em modo standalone.
 */
export function usePWAInstallTracking() {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Evitar múltiplos registros na mesma sessão
    if (hasTracked.current) return;

    const trackInstallation = async (isStandalone: boolean) => {
      // Verificar se já rastreamos esta instalação (usando localStorage)
      const installKey = `pwa_install_tracked_${TARGET_CLINIC_ID}`;
      const lastTracked = localStorage.getItem(installKey);
      
      // Se já rastreamos nos últimos 24h, não registrar novamente
      if (lastTracked) {
        const lastTime = new Date(lastTracked).getTime();
        const now = Date.now();
        const hoursSince = (now - lastTime) / (1000 * 60 * 60);
        if (hoursSince < 24) return;
      }

      hasTracked.current = true;

      const platform = detectPlatform();
      const deviceInfo = getDeviceInfo();

      try {
        const { error } = await supabase.from("pwa_installations").insert([{
          clinic_id: TARGET_CLINIC_ID,
          platform,
          device_info: deviceInfo as Json,
          user_agent: navigator.userAgent,
          standalone: isStandalone,
          referrer: document.referrer || null,
        }]);

        if (!error) {
          localStorage.setItem(installKey, new Date().toISOString());
          console.log("[PWA Tracking] Instalação registrada:", platform);
        }
      } catch (err) {
        console.error("[PWA Tracking] Erro ao registrar instalação:", err);
      }
    };

    // Detectar se está rodando como PWA standalone
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      // Está rodando como app instalado
      trackInstallation(true);
    }

    // Listener para o evento de instalação
    const handleAppInstalled = () => {
      console.log("[PWA Tracking] App instalado!");
      trackInstallation(true);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);
}

function detectPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(ua)) return "iOS";
  if (/android/.test(ua)) return "Android";
  if (/windows/.test(ua)) return "Windows";
  if (/macintosh|mac os x/.test(ua)) return "macOS";
  if (/linux/.test(ua)) return "Linux";
  
  return "Unknown";
}

function getDeviceInfo(): Record<string, unknown> {
  return {
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    devicePixelRatio: window.devicePixelRatio,
    language: navigator.language,
    languages: navigator.languages,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
    vendor: navigator.vendor,
  };
}
