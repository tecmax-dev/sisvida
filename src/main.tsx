import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";
import { startUIIntegrityGuard } from "./hooks/useUIIntegrityGuard";

const isProsindWebMarketingRoot = () => {
  const host = window.location.hostname;
  const path = window.location.pathname;
  return (
    (host === "prosindweb.com.br" || host === "www.prosindweb.com.br") &&
    !path.startsWith("/app") &&
    !path.startsWith("/sindicato")
  );
};

const isPreviewOrIframe = () => {
  const host = window.location.hostname;
  const isPreviewHost = host.includes("id-preview--") || host.includes("lovableproject.com");
  let isIframe = false;
  try {
    isIframe = window.self !== window.top;
  } catch {
    isIframe = true;
  }
  return isPreviewHost || isIframe;
};

/**
 * BOOTSTRAP IMPERATIVO PARA APP MOBILE
 * Executa verificação de sessão ANTES do React renderizar
 */
async function bootstrapApp() {
  const isMobileRoute = window.location.pathname.startsWith('/app');
  
  if (isMobileRoute) {
    console.info("[MAIN] Mobile route detectada, iniciando mobileBootstrap...");
    const { mobileBootstrap } = await import('./mobileBootstrap');
    const result = await mobileBootstrap();
    
    console.info('[MAIN] Bootstrap mobile completo:', result.initialRoute);
    
    // Redirecionar /app para /app/home se autenticado
    if (window.location.pathname === '/app' || window.location.pathname === '/app/') {
      if (result.isAuthenticated) {
        window.history.replaceState(null, '', '/app/home');
      }
    }
  }
  
  await renderApp();
}

/**
 * Registra Service Worker e renderiza React
 */
async function renderApp() {
  /**
   * ONE-SHOT CACHE WIPE — disparado por mudança de ícone/branding.
   *
   * Bump deste valor força TODOS os dispositivos a apagarem caches do Workbox
   * e os ícones cacheados pelo Chrome WebAPK na primeira carga após a atualização.
   * Roda apenas uma vez por dispositivo (flag salva em localStorage).
   */
  const CACHE_WIPE_VERSION = "20260528-new-install-route-baixar-app";
  try {
    const last = localStorage.getItem("__pwa_cache_wipe_version");
    if (last !== CACHE_WIPE_VERSION) {
      console.info(`[PWA] Cache wipe ${CACHE_WIPE_VERSION} — limpando caches antigos…`);
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
      }
      localStorage.setItem("__pwa_cache_wipe_version", CACHE_WIPE_VERSION);
      // Recarrega para registrar o SW novo do zero (com os ícones atualizados).
      // Marcamos a flag ANTES do reload para não entrar em loop.
      window.location.reload();
      return;
    }
  } catch (err) {
    console.warn("[PWA] Cache wipe falhou (não é crítico):", err);
  }

  const shouldDisableServiceWorker = isPreviewOrIframe() || isProsindWebMarketingRoot();

  if (!shouldDisableServiceWorker) {
    // Registrar PWA e aplicar novas versões automaticamente para evitar shell desatualizado
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.info('[PWA] Nova versão disponível - aplicando atualização automática');
        void updateSW(true);
      },
      onOfflineReady() {
        console.info('[PWA] App pronto para uso offline');
      },
      onRegistered() {
        console.info('[PWA] Service Worker registrado');
      },
      onRegisterError(error) {
        console.error('[PWA] Erro no registro do SW:', error);
      },
    });
  }

  // Força checagem de atualização ao abrir o app instalado
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)))
    );
  }

  // Função global para forçar atualização manual do PWA (opcional)
  (window as any).forceUpdatePWA = async (): Promise<boolean> => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.update().catch(() => {})));
      }
      window.location.reload();
      return true;
    } catch (error) {
      console.error('Erro ao forçar atualização:', error);
      return false;
    }
  };

  // Função global para limpar cache completo de pop-ups do PWA (sessão + dados)
  (window as any).clearPopupCache = (): void => {
    // Limpa o registro de avisos visualizados
    sessionStorage.removeItem("popup_notices_dismissed");
    
    // Limpa o cache do React Query para forçar refetch
    if ((window as any).__REACT_QUERY_CLIENT__) {
      (window as any).__REACT_QUERY_CLIENT__.invalidateQueries({ queryKey: ["popup-notices-active"] });
    }
    
    console.info('[PWA] Cache de pop-ups limpo. Recarregue a página para ver os avisos atualizados.');
  };

  // Ativar guard de integridade de UI contra injeções não autorizadas
  startUIIntegrityGuard();

  createRoot(document.getElementById("root")!).render(<App />);
}

// Iniciar aplicação
bootstrapApp();
