import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// 🔥 PANIC TRACE - Log imediato para detectar reloads
console.info("[MAIN] ====== SCRIPT INICIO ======", {
  ts: Date.now(),
  url: window.location.href,
  search: window.location.search,
});

// Contador de execuções do script (detecta reload loops)
declare global {
  interface Window {
    __MAIN_EXEC_COUNT__?: number;
  }
}
window.__MAIN_EXEC_COUNT__ = (window.__MAIN_EXEC_COUNT__ ?? 0) + 1;
console.info("[MAIN] Execução #", window.__MAIN_EXEC_COUNT__);

// 🔥 PANIC MODE: Desabilitar hard reset temporariamente
const PWA_HARD_RESET_ENABLED = false; // DESABILITADO para debug
const PWA_HARD_RESET_VERSION = "20260202c";
const PWA_HARD_RESET_STORAGE_KEY = "pwa_hard_reset_version";

/**
 * BOOTSTRAP IMPERATIVO - Executa ANTES do React
 */
async function bootstrapApp() {
  console.info("[MAIN] bootstrapApp() start");
  
  // 🔥 Se ?isolate=1, pular TODO o bootstrap móvel
  const isolate = new URLSearchParams(window.location.search).has("isolate");
  if (isolate) {
    console.info("[MAIN] ISOLATE MODE - pulando mobileBootstrap");
    await renderApp();
    return;
  }
  
  const isMobileRoute = window.location.pathname.startsWith('/app');
  
  if (isMobileRoute) {
    console.info("[MAIN] Mobile route detectada, iniciando mobileBootstrap...");
    const { mobileBootstrap } = await import('./mobileBootstrap');
    const result = await mobileBootstrap();
    
    console.info('[MAIN] Bootstrap mobile completo:', result.initialRoute);
    
    if (window.location.pathname === '/app' || window.location.pathname === '/app/') {
      if (result.isAuthenticated) {
        window.history.replaceState(null, '', '/app/home');
      }
    }
  }
  
  console.info("[MAIN] Chamando renderApp()...");
  await renderApp();
}

/**
 * Limpeza HARD do PWA - DESABILITADO TEMPORARIAMENTE
 */
async function hardResetPWAIfNeeded(): Promise<boolean> {
  // 🔥 PANIC: Desabilitado para debug
  if (!PWA_HARD_RESET_ENABLED) {
    console.info("[MAIN] hardResetPWAIfNeeded() DESABILITADO");
    return false;
  }
  
  try {
    const alreadyResetForThisVersion =
      localStorage.getItem(PWA_HARD_RESET_STORAGE_KEY) === PWA_HARD_RESET_VERSION;

    console.info("[MAIN] hardResetPWAIfNeeded()", { 
      alreadyResetForThisVersion, 
      storedVersion: localStorage.getItem(PWA_HARD_RESET_STORAGE_KEY),
      targetVersion: PWA_HARD_RESET_VERSION 
    });

    if (alreadyResetForThisVersion) return false;

    localStorage.setItem(PWA_HARD_RESET_STORAGE_KEY, PWA_HARD_RESET_VERSION);
    console.warn('[MAIN] Hard reset - RELOAD IMINENTE');

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((r) => r.unregister().catch(() => undefined))
      );
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    window.location.reload();
    return true;
  } catch (e) {
    console.warn('[MAIN] Falha no hard reset:', e);
    return false;
  }
}

// Limpar TODOS os caches ao iniciar o app para garantir dados frescos
async function clearAllCaches(): Promise<boolean> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      
      // Filtrar apenas caches de dados (não limpar caches de assets estáticos)
      const dataCaches = cacheNames.filter(name => 
        name.includes('supabase') || 
        name.includes('api') || 
        name.includes('runtime')
      );
      
      if (dataCaches.length > 0) {
        console.log('[PWA] Limpando caches de dados:', dataCaches);
        await Promise.all(dataCaches.map(name => caches.delete(name)));
        console.log('[PWA] Caches de dados limpos com sucesso');
        return true;
      } else {
        console.log('[PWA] Nenhum cache de dados para limpar');
      }
    } catch (e) {
      console.warn('[PWA] Erro ao limpar caches:', e);
    }
  }
  return false;
}

// Force update service worker (without notification loop)
async function forceServiceWorkerUpdate() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      await Promise.all(
        registrations.map(async (r) => {
          await r.update();
          // If there's a waiting SW, activate it immediately (no notifications)
          if (r.waiting) {
            r.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        })
      );
      
      console.log('[PWA] Service Workers updated');
    } catch (e) {
      console.warn('[PWA] Error updating SW:', e);
    }
  }
}

async function renderApp() {
  console.info("[MAIN] renderApp() start");
  
  // 🔥 PANIC: Hard reset desabilitado
  const didHardReset = await hardResetPWAIfNeeded();
  if (didHardReset) {
    console.warn("[MAIN] Hard reset executou reload - saindo");
    return;
  }

  // 🔥 PANIC: Desabilitar limpeza de cache para debug
  console.info('[MAIN] Pulando clearAllCaches (desabilitado para debug)');
  // await clearAllCaches();
  
  // 🔥 PANIC: Desabilitar update forçado do SW
  console.info('[MAIN] Pulando forceServiceWorkerUpdate (desabilitado para debug)');
  // forceServiceWorkerUpdate();

  // 🔥 PANIC: Registro PWA simplificado
  console.info("[MAIN] Registrando SW (simplificado)...");
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.info('[MAIN] onNeedRefresh - NÃO aplicando auto-update');
      // 🔥 PANIC: NÃO chamar updateSW(true) automaticamente
    },
    onOfflineReady() {
      console.info('[MAIN] onOfflineReady');
    },
    onRegistered(r) {
      console.info('[MAIN] SW registered');
      // 🔥 PANIC: Desabilitar interval de update
    },
    onRegisterError(error) {
      console.error('[MAIN] SW registration error:', error);
    },
  });

  // Função global para forçar atualização do PWA (mantida para uso manual)
  (window as any).forceUpdatePWA = async (): Promise<boolean> => {
    console.info('forceUpdatePWA chamado manualmente');
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.update().catch(() => {})));
      }
      (updateSW as any)(true);
      return true;
    } catch (error) {
      console.error('Erro ao forçar atualização:', error);
      return false;
    }
  };

  console.info("[MAIN] Renderizando React...");
  createRoot(document.getElementById("root")!).render(<App />);
  console.info("[MAIN] React renderizado!");
}

// Executar bootstrap imperativo
console.info("[MAIN] Chamando bootstrapApp()...");
bootstrapApp();
