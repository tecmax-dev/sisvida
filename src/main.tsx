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

function renderApp() {
  // Registrar Service Worker para PWA
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('Nova versão do PWA disponível. Atualize manualmente quando conveniente.');
    },
    onOfflineReady() {
      console.log('App pronto para uso offline');
    },
    onRegistered(r) {
      console.log('Service Worker registrado:', r);
      if (r) {
        setInterval(() => {
          console.log('Verificando atualizações do PWA...');
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('Erro ao registrar Service Worker:', error);
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
