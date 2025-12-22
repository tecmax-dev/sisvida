import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Registrar Service Worker para PWA
const updateSW = registerSW({
  immediate: true, // Registra imediatamente
  onNeedRefresh() {
    // Atualizar automaticamente sem perguntar
    console.log('Nova versão disponível, atualizando...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App pronto para uso offline');
  },
  onRegistered(r) {
    console.log('Service Worker registrado:', r);
    // Verificar atualizações periodicamente (a cada 1 hora)
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
(window as any).forceUpdatePWA = async () => {
  console.log('Forçando atualização do PWA...');
  
  // Limpar todos os caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => {
      console.log('Limpando cache:', name);
      return caches.delete(name);
    }));
    console.log('Todos os caches limpos');
  }
  
  // Desregistrar Service Workers antigos
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => {
      console.log('Desregistrando SW:', r);
      return r.unregister();
    }));
    console.log('Service Workers desregistrados');
  }
  
  // Recarregar a página
  window.location.reload();
};

createRoot(document.getElementById("root")!).render(<App />);
