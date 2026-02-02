import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Mapeamento de domínios personalizados para suas rotas específicas
 * Quando acessado via domínio customizado, redireciona para o módulo correto
 */
const CUSTOM_DOMAIN_ROUTES: Record<string, { 
  basePath: string; 
  defaultRoute: string;
  clinicId?: string;
}> = {
  // SECMI - Sindicato dos Comerciários de Ilhéus
  "app.secmi.org.br": {
    basePath: "/sindicato",
    defaultRoute: "/sindicato/instalar",
    clinicId: "89e7585e-7bce-4e58-91fa-c37080d1170d",
  },
  // Adicione outros domínios personalizados aqui
  // "app.outrosindicato.com.br": {
  //   basePath: "/sindicato",
  //   defaultRoute: "/sindicato/instalar",
  //   clinicId: "outro-uuid",
  // },
};

/**
 * Hook para detectar se está em um domínio personalizado
 */
export function useCustomDomain() {
  if (typeof window === "undefined") return null;
  
  const hostname = window.location.hostname;
  return CUSTOM_DOMAIN_ROUTES[hostname] || null;
}

/**
 * Componente que redireciona automaticamente baseado no domínio
 * Deve ser usado no App.tsx para interceptar a navegação
 */
export function DomainRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const customDomain = useCustomDomain();

  useEffect(() => {
    if (!customDomain) return;

    const currentPath = location.pathname;
    
    // Se estiver na raiz ou em rotas que não pertencem ao módulo, redireciona
    if (currentPath === "/" || currentPath === "") {
      console.info(`[DomainRedirect] Redirecionando de ${currentPath} para ${customDomain.defaultRoute}`);
      navigate(customDomain.defaultRoute, { replace: true });
      return;
    }

    // Se tentar acessar /instalar, redireciona para /sindicato/instalar
    if (currentPath === "/instalar") {
      console.info(`[DomainRedirect] Redirecionando /instalar para ${customDomain.defaultRoute}`);
      navigate(customDomain.defaultRoute, { replace: true });
      return;
    }

    // Mapeia rotas raiz para rotas do sindicato
    const routeMappings: Record<string, string> = {
      "/app": "/sindicato/app",
      "/app/home": "/sindicato/app/home",
      "/app/login": "/sindicato/app/login",
      "/app/agendar": "/sindicato/app/agendar",
      "/app/consultas": "/sindicato/app/consultas",
      "/app/perfil": "/sindicato/app/perfil",
      "/app/carteirinha": "/sindicato/app/carteirinha",
    };

    const mappedRoute = routeMappings[currentPath];
    if (mappedRoute) {
      console.info(`[DomainRedirect] Mapeando ${currentPath} para ${mappedRoute}`);
      navigate(mappedRoute, { replace: true });
    }
  }, [customDomain, location.pathname, navigate]);

  return null;
}

/**
 * Retorna o clinic_id baseado no domínio atual
 * Útil para pré-configurar contextos
 */
export function getClinicIdFromDomain(): string | null {
  if (typeof window === "undefined") return null;
  
  const hostname = window.location.hostname;
  const domainConfig = CUSTOM_DOMAIN_ROUTES[hostname];
  
  return domainConfig?.clinicId || null;
}

/**
 * Verifica se está em um domínio personalizado de sindicato
 */
export function isCustomUnionDomain(): boolean {
  if (typeof window === "undefined") return false;
  
  const hostname = window.location.hostname;
  return hostname in CUSTOM_DOMAIN_ROUTES;
}
