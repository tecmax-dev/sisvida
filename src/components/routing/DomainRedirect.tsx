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
  // Eclini - App Sindicato Redirect
  "app.eclini.com.br": {
    basePath: "/sindicato",
    defaultRoute: "/instalar",
    clinicId: "89e7585e-7bce-4e58-91fa-c37080d1170d",
  },
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

  // Link de filiação ao qual o QR Code impresso (app.eclini.com.br/app/instalar)
  // deve redirecionar. Solicitação do sindicato: SECMI.
  const FILIACAO_REDIRECT_URL =
    "https://prosindweb.com.br/sindical/filiacao/74f74e75-6b09-43d5-bf75-41225e085e28";

  useEffect(() => {
    if (!customDomain) return;

    const currentPath = location.pathname;
    const hostname = window.location.hostname;
    const isEcliniDomain = hostname === "app.eclini.com.br";

    // QR Code impresso aponta para app.eclini.com.br (/, /instalar ou /app/instalar)
    // → redirecionar diretamente para a página de filiação do SECMI.
    const normalizedPath = currentPath.replace(/\/$/, "");
    if (
      isEcliniDomain &&
      (normalizedPath === "" ||
        normalizedPath === "/" ||
        normalizedPath === "/instalar" ||
        normalizedPath === "/app/instalar")
    ) {
      console.info(
        `[DomainRedirect] QR app.eclini.com.br → redirecionando para ${FILIACAO_REDIRECT_URL}`
      );
      window.location.replace(FILIACAO_REDIRECT_URL);
      return;
    }

    // Se estiver na raiz ou em rotas que não pertencem ao módulo, redireciona
    if (currentPath === "/" || currentPath === "") {
      console.info(`[DomainRedirect] Redirecionando de ${currentPath} para ${customDomain.defaultRoute}`);
      navigate(customDomain.defaultRoute, { replace: true });
      return;
    }

      // Se tentar acessar /instalar ou /app/instalar em outros domínios customizados
      if (normalizedPath === "/instalar" || normalizedPath === "/app/instalar") {
        const redirectDomains = ["app.eclini.com.br", "prosindweb.com.br"];
        if (redirectDomains.some(domain => window.location.hostname.includes(domain))) {
          // Se o script no index.html não pegou (ex: navegação SPA), forçamos aqui
         const userAgent = window.navigator.userAgent.toLowerCase();
         if (userAgent.indexOf("android") > -1) {
           console.info("[DomainRedirect] Android detectado no /instalar do app.eclini.com.br. Redirecionando...");
           window.location.replace("https://play.google.com/store/apps/details?id=br.org.secmi.comerciariosilheus.app&hl=pt_BR");
           return;
         }
       } else {
         // Para outros domínios customizados, redireciona para a rota padrão do domínio
         console.info(`[DomainRedirect] Redirecionando /instalar para ${customDomain.defaultRoute}`);
         navigate(customDomain.defaultRoute, { replace: true });
         return;
       }
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
