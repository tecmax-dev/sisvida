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

// Forçar atualização do Service Worker
async function forceServiceWorkerUpdate() {
  if ('serviceWorker' in navigator) {
    try {
      // Emitir evento de verificação
      window.dispatchEvent(new CustomEvent('pwa-checking-update'));
      
      const registrations = await navigator.serviceWorker.getRegistrations();
      let updateFound = false;
      
      await Promise.all(
        registrations.map(async (r) => {
          await r.update();
          // Se há um SW waiting, ativar imediatamente
          if (r.waiting) {
            updateFound = true;
            window.dispatchEvent(new CustomEvent('pwa-update-found'));
            r.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        })
      );
      
      if (updateFound) {
        // Aguardar um pouco para o SW ativar
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('pwa-update-applied'));
        }, 1500);
      }
      
      console.log('[PWA] Service Workers atualizados');
    } catch (e) {
      console.warn('[PWA] Erro ao atualizar SW:', e);
      window.dispatchEvent(new CustomEvent('pwa-update-error', { detail: e }));
    }
  }
}

async function renderApp() {
  // Limpar caches de dados ANTES de renderizar (aguardar conclusão)
  console.log('[PWA] Iniciando limpeza de cache...');
  await clearAllCaches();
  
  // Forçar atualização do Service Worker
  forceServiceWorkerUpdate();

  // Registrar Service Worker para PWA
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nova versão disponível, aplicando automaticamente...');
      window.dispatchEvent(new CustomEvent('pwa-update-found'));
      // Auto-aplicar atualização
      updateSW(true);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('pwa-update-applied'));
      }, 1500);
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
          window.dispatchEvent(new CustomEvent('pwa-checking-update'));
          r.update();
        }, 5 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Erro ao registrar Service Worker:', error);
      window.dispatchEvent(new CustomEvent('pwa-update-error', { detail: error }));
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
