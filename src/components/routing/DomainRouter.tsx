import { Navigate } from 'react-router-dom';
import Index from '@/pages/Index';

/**
 * DomainRouter - Componente que roteia baseado no domínio/subdomínio
 * 
 * - eclini.com.br (domínio principal) → Landing page
 * - app.eclini.com.br (subdomínio app) → Redireciona para /auth
 * - localhost/preview → Mostra landing page (desenvolvimento)
 */
export const DomainRouter = () => {
  const hostname = window.location.hostname;
  
  // Verifica se está no subdomínio "app"
  const isAppSubdomain = hostname.startsWith('app.') || hostname.includes('.app.');
  
  // Se estiver no subdomínio app, redireciona para autenticação
  if (isAppSubdomain) {
    return <Navigate to="/auth" replace />;
  }
  
  // Domínio principal ou localhost: mostra landing page
  return <Index />;
};

export default DomainRouter;
