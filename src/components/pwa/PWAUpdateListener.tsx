import { usePWAUpdate } from '@/hooks/usePWAUpdate';

/**
 * Componente invisível que escuta eventos de atualização do PWA
 * e mostra toasts para o usuário
 */
export function PWAUpdateListener() {
  usePWAUpdate();
  return null;
}
