import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

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
  
  if (isMobileRoute) {
    // Importar e executar bootstrap mobile ANTES do React
    const { mobileBootstrap } = await import('./mobileBootstrap');
    const result = await mobileBootstrap();
    
    console.log('[Main] Bootstrap mobile completo:', result.initialRoute);
    
    // APENAS redirecionar para /app/home se estiver logado e na raiz /app
    // Se NÃO estiver logado, deixar na rota pública /app (index = MobilePublicHomePage)
    if (window.location.pathname === '/app' || window.location.pathname === '/app/') {
      if (result.isAuthenticated) {
        window.history.replaceState(null, '', '/app/home');
      }
      // Se não autenticado, NÃO redireciona - fica na página pública
    }
  }
  
  // Agora renderizar React com a rota já definida
  await renderApp();
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
  // Limpar caches de dados ANTES de renderizar (aguardar conclusão)
  console.log('[PWA] Iniciando limpeza de cache...');
  await clearAllCaches();
  
  // Forçar atualização do Service Worker
  forceServiceWorkerUpdate();

  // Register Service Worker for PWA (without update notification loop)
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] New version available, applying silently...');
      // Auto-apply update without notifications
      updateSW(true);
    },
    onOfflineReady() {
      console.log('[PWA] App ready for offline use');
    },
    onRegistered(r) {
      console.log('[PWA] Service Worker registered');
      if (r) {
        // Check for updates every 10 minutes (silently)
        setInterval(() => {
          r.update();
        }, 10 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  // Função global para forçar atualização do PWA
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

      // Pede para o PWA aplicar a atualização quando houver (skipWaiting/clientsClaim)
      // Isso NÃO apaga nem desregistra nenhum SW.
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

  createRoot(document.getElementById("root")!).render(<App />);
}

// Executar bootstrap imperativo
bootstrapApp();
