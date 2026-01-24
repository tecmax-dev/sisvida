import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Rotas que não devem exibir o botão voltar (páginas públicas e iniciais)
const EXCLUDED_ROUTES = [
  "/",
  "/auth",
  "/cadastro",
  "/app", // Mobile welcome
  "/sindical",
  "/sistema-sindical",
  "/entidade-sindical",
  "/login-sindical",
  "/acessos",
  "/portais",
  "/apresentacao",
  "/apresentacao-clinica",
  "/apresentacao-eclini",
  "/tutorial-sindicato",
  "/lgpd",
];

// Prefixos de rotas públicas que não devem exibir o botão
const EXCLUDED_PREFIXES = [
  "/agendamento/",
  "/anamnese/",
  "/nps/",
  "/confirmar/",
  "/painel/",
  "/totem/",
  "/validar-",
  "/empresa/",
  "/contabilidade/",
  "/homologacao/",
  "/contribuicao/",
  "/negociacao/",
  "/socio/",
  "/telemedicina/",
  "/profissional/",
];

// Rotas que são "raiz" de um contexto (voltar vai para home ou dashboard)
const ROOT_ROUTES: Record<string, string> = {
  "/dashboard": "/",
  "/admin": "/",
  "/union": "/dashboard",
};

export function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  // Não exibir em rotas excluídas exatas
  if (EXCLUDED_ROUTES.includes(pathname)) {
    return null;
  }

  // Não exibir em rotas com prefixos excluídos (páginas públicas)
  if (EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return null;
  }

  // Não exibir na raiz do mobile app autenticado
  if (pathname === "/app/home") {
    return null;
  }

  // Não exibir em páginas de ajuda/docs
  if (pathname.startsWith("/ajuda")) {
    return null;
  }

  const handleBack = () => {
    // Se for uma rota raiz, ir para o destino definido
    if (ROOT_ROUTES[pathname]) {
      navigate(ROOT_ROUTES[pathname]);
      return;
    }

    // Se houver histórico, voltar
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      // Fallback: ir para a página anterior na hierarquia da URL
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length > 1) {
        segments.pop();
        navigate("/" + segments.join("/"));
      } else {
        navigate("/");
      }
    }
  };

  // Detectar se está em uma rota com sidebar (dashboard, union, admin)
  const hasSidebar = pathname.startsWith("/dashboard") || 
                     pathname.startsWith("/union") || 
                     pathname.startsWith("/admin");

  return (
    <div 
      className="fixed top-4 right-4 lg:right-6 z-50 transition-all"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={handleBack}
        className="gap-2 bg-background/95 backdrop-blur-sm shadow-sm hover:shadow-md transition-all border-border h-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Voltar</span>
      </Button>
    </div>
  );
}
