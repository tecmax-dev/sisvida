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
  renderApp();
}

// Limpar caches antigos ao iniciar o app
async function clearOldCaches() {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.includes('workbox') || 
        name.includes('supabase-cache') ||
        name.includes('runtime')
      );
      
      if (oldCaches.length > 0) {
        console.log('[PWA] Limpando caches antigos:', oldCaches);
        await Promise.all(oldCaches.map(name => caches.delete(name)));
      }
    } catch (e) {
      console.warn('[PWA] Erro ao limpar caches:', e);
    }
  }
}

// Forçar atualização do Service Worker
async function forceServiceWorkerUpdate() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (r) => {
          await r.update();
          // Se há um SW waiting, ativar imediatamente
          if (r.waiting) {
            r.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        })
      );
      console.log('[PWA] Service Workers atualizados');
    } catch (e) {
      console.warn('[PWA] Erro ao atualizar SW:', e);
    }
  }
}

function renderApp() {
  // Limpar caches e forçar atualização ao abrir o app
  clearOldCaches();
  forceServiceWorkerUpdate();

  // Registrar Service Worker para PWA
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nova versão disponível, aplicando automaticamente...');
      // Auto-aplicar atualização
      updateSW(true);
    },
    onOfflineReady() {
      console.log('[PWA] App pronto para uso offline');
    },
    onRegistered(r) {
      console.log('[PWA] Service Worker registrado:', r);
      if (r) {
        // Verificar atualizações a cada 5 minutos
        setInterval(() => {
          console.log('[PWA] Verificando atualizações...');
          r.update();
        }, 5 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Erro ao registrar Service Worker:', error);
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
