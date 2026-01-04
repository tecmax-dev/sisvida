import { Building2, Users, Calculator } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface PortalCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

const portals: PortalCard[] = [
  {
    title: "Empresas",
    description: "Emissão de boletos para empresas, gerenciamento de contribuições e controle de acessos.",
    icon: Building2,
    href: "/portal-empresa",
    color: "text-amber-600",
  },
  {
    title: "Sócios",
    description: "Acesso restrito para associados, gerenciamento de benefícios, boletos e outros serviços.",
    icon: Users,
    href: "/portal-socio",
    color: "text-purple-600",
  },
  {
    title: "Escritórios",
    description: "Emissão de boletos realizada por escritórios de contabilidade para gestores de múltiplas empresas.",
    icon: Calculator,
    href: "/portal-contador",
    color: "text-cyan-600",
  },
];

const PortalsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#3a6ea5] relative overflow-hidden">
      {/* Geometric pattern background */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1.5" fill="white" opacity="0.5" />
            </pattern>
            <pattern id="lines" width="100" height="100" patternUnits="userSpaceOnUse">
              <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.5" opacity="0.3" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <rect width="100%" height="100%" fill="url(#lines)" />
          {/* Decorative lines */}
          <line x1="0" y1="0" x2="30%" y2="40%" stroke="white" strokeWidth="0.5" opacity="0.4" />
          <line x1="100%" y1="0" x2="70%" y2="35%" stroke="white" strokeWidth="0.5" opacity="0.4" />
          <line x1="0" y1="100%" x2="25%" y2="60%" stroke="white" strokeWidth="0.5" opacity="0.4" />
          <line x1="100%" y1="100%" x2="75%" y2="65%" stroke="white" strokeWidth="0.5" opacity="0.4" />
          {/* Connection nodes */}
          <circle cx="15%" cy="20%" r="3" fill="white" opacity="0.3" />
          <circle cx="85%" cy="25%" r="3" fill="white" opacity="0.3" />
          <circle cx="10%" cy="70%" r="3" fill="white" opacity="0.3" />
          <circle cx="90%" cy="75%" r="3" fill="white" opacity="0.3" />
          <circle cx="30%" cy="40%" r="4" fill="white" opacity="0.4" />
          <circle cx="70%" cy="35%" r="4" fill="white" opacity="0.4" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Logo/Header */}
        <div className="mb-8 text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border-2 border-white/20">
            <Building2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-medium text-white">
            Escolha uma opção abaixo.
          </h1>
        </div>

        {/* Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          {portals.map((portal) => (
            <div
              key={portal.title}
              className="bg-white rounded-lg shadow-lg overflow-hidden"
            >
              {/* Colored top border */}
              <div className={`h-1 ${
                portal.title === "Empresas" ? "bg-amber-500" :
                portal.title === "Sócios" ? "bg-purple-500" :
                "bg-cyan-500"
              }`} />
              
              <div className="p-8 text-center">
                <h2 className="text-2xl font-normal text-gray-700 mb-4">
                  {portal.title}
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-6 min-h-[60px]">
                  {portal.description}
                </p>
                
                {/* Divider */}
                <div className="border-t border-gray-200 mb-6" />
                
                <Button
                  onClick={() => navigate(portal.href)}
                  className="bg-[#5a8ac7] hover:bg-[#4a7ab7] text-white px-8 py-2 rounded font-normal"
                >
                  Acessar
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-white/70 text-sm">
          <div className="flex items-center justify-center gap-4 mb-2">
            <span className="hover:text-white cursor-pointer">Suporte</span>
            <span className="hover:text-white cursor-pointer">Ajuda</span>
            <span className="hover:text-white cursor-pointer">Privacidade</span>
            <span className="hover:text-white cursor-pointer">Termo de serviços</span>
          </div>
          <p className="text-white/50">
            © {new Date().getFullYear()} Sistema de Gestão. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortalsPage;
