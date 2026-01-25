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
async function bootstrapApp() {
  const isMobileRoute = window.location.pathname.startsWith('/app');
  
  if (isMobileRoute) {
    // Importar e executar bootstrap mobile ANTES do React
    const { mobileBootstrap } = await import('./mobileBootstrap');
    const result = await mobileBootstrap();
    
    console.log('[Main] Bootstrap mobile completo:', result.initialRoute);
    
    // Se estamos na raiz /app, redirecionar ANTES do React montar
    if (window.location.pathname === '/app' || window.location.pathname === '/app/') {
      window.history.replaceState(null, '', result.initialRoute);
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
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => {
          console.log('Limpando cache:', name);
          return caches.delete(name);
        }));
        console.log('Todos os caches limpos');
      }
      
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => {
          console.log('Desregistrando SW:', r);
          return r.unregister();
        }));
        console.log('Service Workers desregistrados');
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
