import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Registrar Service Worker para PWA
// IMPORTANTE: NÃO forçar reload automático para manter estabilidade da aplicação
const updateSW = registerSW({
  immediate: true, // Registra imediatamente
  onNeedRefresh() {
    // Apenas logar - não forçar reload automático
    // O usuário pode atualizar manualmente quando quiser
    console.log('Nova versão do PWA disponível. Atualize manualmente quando conveniente.');
  },
  onOfflineReady() {
    console.log('App pronto para uso offline');
  },
  onRegistered(r) {
    console.log('Service Worker registrado:', r);
    // Verificar atualizações periodicamente (a cada 1 hora) - sem forçar reload
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

// Função global para forçar atualização do PWA (apenas quando usuário solicitar explicitamente)
// Esta função só deve ser chamada por ação explícita do usuário (botão de atualização)
(window as any).forceUpdatePWA = async (): Promise<boolean> => {
  console.log('Forçando atualização do PWA...');
  
  try {
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
    
    return true; // Indica sucesso - chamador decide se quer reload
  } catch (error) {
    console.error('Erro ao forçar atualização do PWA:', error);
    return false;
  }
};

createRoot(document.getElementById("root")!).render(<App />);
