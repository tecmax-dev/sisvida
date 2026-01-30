import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Hook para escutar eventos de atualização do PWA e informar o usuário
 */
export function usePWAUpdate() {
  useEffect(() => {
    // Escutar evento de atualização encontrada
    const handleUpdateFound = () => {
      toast.info('Nova versão encontrada!', {
        description: 'Atualizando o aplicativo...',
        duration: 3000,
      });
    };

    // Escutar evento de atualização aplicada
    const handleUpdateApplied = () => {
      toast.success('App atualizado!', {
        description: 'Você está usando a versão mais recente.',
        duration: 4000,
      });
    };

    // Escutar evento de verificação iniciada
    const handleCheckingUpdate = () => {
      console.log('[PWA] Verificando atualizações...');
    };

    // Escutar evento de erro
    const handleUpdateError = (e: CustomEvent) => {
      console.error('[PWA] Erro na atualização:', e.detail);
    };

    window.addEventListener('pwa-update-found', handleUpdateFound);
    window.addEventListener('pwa-update-applied', handleUpdateApplied);
    window.addEventListener('pwa-checking-update', handleCheckingUpdate);
    window.addEventListener('pwa-update-error', handleUpdateError as EventListener);

    return () => {
      window.removeEventListener('pwa-update-found', handleUpdateFound);
      window.removeEventListener('pwa-update-applied', handleUpdateApplied);
      window.removeEventListener('pwa-checking-update', handleCheckingUpdate);
      window.removeEventListener('pwa-update-error', handleUpdateError as EventListener);
    };
  }, []);
}
