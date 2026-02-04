import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

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
  // Registrar PWA com estratégia passiva (sem auto-refresh)
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // PWA atualiza silenciosamente no próximo reload
      console.info('[PWA] Nova versão disponível - será aplicada no próximo reload');
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

  createRoot(document.getElementById("root")!).render(<App />);
}

// Iniciar aplicação
bootstrapApp();
