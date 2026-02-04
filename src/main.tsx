import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Hard reset (apaga caches + desregistra SW) uma vez por versão para forçar atualização imediata
const PWA_HARD_RESET_VERSION = "20260202c";
const PWA_HARD_RESET_STORAGE_KEY = "pwa_hard_reset_version";

/**
 * BOOTSTRAP IMPERATIVO - Executa ANTES do React
 * 
 * Para rotas mobile (/app/*), verifica sessão e decide rota inicial
 * ANTES de renderizar qualquer componente React.
 */
/**
 * BOOTSTRAP IMPERATIVO - Executa ANTES do React
 * 
 * IMPORTANTE: A rota /app é PÚBLICA por padrão (MobilePublicHomePage).
 * O bootstrap NÃO redireciona para login - apenas verifica se há sessão
 * para redirecionar para /app/home se o usuário já estiver logado.
 */
async function bootstrapApp() {
  const isMobileRoute = window.location.pathname.startsWith('/app');
  const currentSearch = window.location.search;
  const currentHash = window.location.hash;
  
  if (isMobileRoute) {
    // Importar e executar bootstrap mobile ANTES do React
    const { mobileBootstrap } = await import('./mobileBootstrap');
    const result = await mobileBootstrap();
    
    console.log('[Main] Bootstrap mobile completo:', result.initialRoute);
    
    // APENAS redirecionar para /app/home se estiver logado e na raiz /app
    // Se NÃO estiver logado, deixar na rota pública /app (index = MobilePublicHomePage)
    if (window.location.pathname === '/app' || window.location.pathname === '/app/') {
      if (result.isAuthenticated) {
        // CRÍTICO (preview): preservar query string (ex.: __lovable_token) para não quebrar reloads.
        window.history.replaceState(null, '', `/app/home${currentSearch}${currentHash}`);
      }
      // Se não autenticado, NÃO redireciona - fica na página pública
    }
  }
  
  // Agora renderizar React com a rota já definida
  await renderApp();
}

function isStandalonePWA(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  } catch {
    return false;
  }
}

function shouldEnablePWAOps(): boolean {
  // Evita loops globais: operações agressivas de SW/cache só no contexto PWA ou no app mobile.
  // Também evita quebrar o preview (token na URL) com reloads automáticos.
  const isMobileRoute = window.location.pathname.startsWith('/app');
  const standalone = isStandalonePWA();
  const isPreview = window.location.hostname.includes('lovableproject.com');
  return !isPreview && (standalone || isMobileRoute);
}

/**
 * Limpeza HARD do PWA:
 * - desregistra service workers
 * - apaga TODOS os caches (incluindo precache de assets)
 * 
 * Executa apenas 1x por versão para evitar loops e não degradar performance.
 */
async function hardResetPWAIfNeeded(): Promise<boolean> {
  try {
    const alreadyResetForThisVersion =
      localStorage.getItem(PWA_HARD_RESET_STORAGE_KEY) === PWA_HARD_RESET_VERSION;

    if (alreadyResetForThisVersion) return false;

    // Marcar ANTES do reload para evitar loop
    localStorage.setItem(PWA_HARD_RESET_STORAGE_KEY, PWA_HARD_RESET_VERSION);

    console.log('[PWA] Hard reset iniciado (limpeza total de caches + SW)');

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((r) => r.unregister().catch(() => undefined))
      );
      console.log('[PWA] Service Workers desregistrados');
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('[PWA] Todos os caches apagados:', cacheNames);
    }

    // Recarregar para baixar assets novos e registrar SW novamente
    window.location.reload();
    return true;
  } catch (e) {
    console.warn('[PWA] Falha no hard reset (continuando):', e);
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
  const enablePwaOps = shouldEnablePWAOps();

  if (enablePwaOps) {
    // Forçar limpeza total UMA VEZ nesta versão para aplicar alterações imediatamente
    const didHardReset = await hardResetPWAIfNeeded();
    if (didHardReset) return;

    // Limpar caches de dados ANTES de renderizar (aguardar conclusão)
    console.log('[PWA] Iniciando limpeza de cache...');
    await clearAllCaches();

    // Forçar atualização do Service Worker (best-effort)
    forceServiceWorkerUpdate();

    // Register Service Worker apenas em contexto PWA/mobile.
    // Importante: não auto-aplicar update no onNeedRefresh (isso pode gerar loops).
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] Nova versão disponível (aguardando recarregamento do usuário).');
      },
      onOfflineReady() {
        console.log('[PWA] App ready for offline use');
      },
      onRegistered(r) {
        console.log('[PWA] Service Worker registered');
        if (r) {
          setInterval(() => {
            r.update();
          }, 10 * 60 * 1000);
        }
      },
      onRegisterError(error) {
        console.error('[PWA] Service Worker registration error:', error);
      },
    });

    // Função global para forçar atualização do PWA (manual)
    (window as any).forceUpdatePWA = async (): Promise<boolean> => {
      console.log('Forçando atualização do PWA...');

      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map((r) =>
              r.update().catch((e) => {
                console.warn('Falha ao atualizar SW (continuando):', e);
              })
            )
          );
          console.log('Service Workers atualizados (sem desregistrar)');
        }

        try {
          (updateSW as any)(true);
        } catch (e) {
          console.warn('Não foi possível acionar updateSW (continuando):', e);
        }
        return true;
      } catch (error) {
        console.error('Erro ao forçar atualização do PWA:', error);
        return false;
      }
    };
  } else {
    console.log('[PWA] Operações de SW/cache desativadas (web/preview).');
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

// Executar bootstrap imperativo
bootstrapApp();
