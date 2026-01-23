import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Rotas que não devem exibir o botão voltar
const EXCLUDED_ROUTES = [
  "/",
  "/auth",
  "/cadastro",
  "/app", // Mobile welcome
];

// Rotas que são "raiz" de um contexto (voltar vai para home ou dashboard)
const ROOT_ROUTES: Record<string, string> = {
  "/dashboard": "/",
  "/admin": "/",
  "/union": "/dashboard",
  "/profissional/painel": "/",
};

export function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  // Não exibir em rotas excluídas
  if (EXCLUDED_ROUTES.some(route => pathname === route)) {
    return null;
  }

  // Não exibir na raiz do mobile app autenticado
  if (pathname === "/app/home") {
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

  return (
    <div className="fixed top-20 left-4 z-40 lg:left-6">
      <Button
        variant="outline"
        size="sm"
        onClick={handleBack}
        className="gap-2 bg-background/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Voltar</span>
      </Button>
    </div>
  );
}
