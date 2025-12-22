import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Registrar Service Worker para PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nova versão disponível! Deseja atualizar?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App pronto para uso offline');
  },
  onRegistered(r) {
    console.log('Service Worker registrado:', r);
  },
  onRegisterError(error) {
    console.error('Erro ao registrar Service Worker:', error);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
