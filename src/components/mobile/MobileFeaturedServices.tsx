import { useNavigate } from "react-router-dom";
import { useMobileAppTabs } from "@/hooks/useMobileAppTabs";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import illustrationDependentes from "@/assets/mobile/illustration-dependentes.png";
import illustrationAlterarSenha from "@/assets/mobile/illustration-alterar-senha.png";
import illustrationCarteirinha from "@/assets/mobile/illustration-carteirinha.png";

interface Props {
  dependentsCount: number;
  registrationNumber: string | null;
}

export function MobileFeaturedServices({ dependentsCount, registrationNumber }: Props) {
  const navigate = useNavigate();
  const { isTabActive, loading } = useMobileAppTabs();
  const { isLoggedIn } = useMobileAuth();

  const allServices = [
    { 
      key: "dependentes",
      image: illustrationDependentes,
      label: "Dependentes", 
      onClick: () => navigate("/app/dependentes") 
    },
    { 
      key: "alterar-senha",
      image: illustrationAlterarSenha,
      label: "Alterar senha",
      onClick: () => navigate("/app/alterar-senha") 
    },
    { 
      key: "carteirinha",
      image: illustrationCarteirinha,
      label: "Carteirinha",
      onClick: () => navigate("/app/carteirinha") 
    },
  ];

  // Filter out inactive tabs - Featured services require login
  const services = allServices.filter(service => isTabActive(service.key));

  // Featured services are only shown when logged in
  if (loading || services.length === 0 || !isLoggedIn) {
    return null;
  }

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-bold text-gray-800 tracking-wide mb-3">SERVIÇOS EM DESTAQUE</h3>
      
      <div className="grid grid-cols-3 gap-3">
        {services.map((service, idx) => (
          <button 
            key={idx} 
            onClick={service.onClick} 
            className="bg-white rounded-xl p-3 flex flex-col items-center gap-2 shadow-sm border border-gray-200 transition-all duration-200 active:scale-95"
          >
            <div className="w-20 h-20 flex items-center justify-center">
              <img 
                src={service.image} 
                alt={service.label}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xs font-medium text-gray-700 text-center leading-tight">{service.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
