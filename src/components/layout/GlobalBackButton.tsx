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
  "/app",  // Mobile app - has its own navigation (catch /app and /app/*)
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
  // Botão voltar global desativado
  return null;
}
