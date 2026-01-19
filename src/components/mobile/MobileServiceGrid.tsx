import { useNavigate } from "react-router-dom";
import { useMobileAppTabs } from "@/hooks/useMobileAppTabs";
import illustrationAgendamentos from "@/assets/mobile/illustration-agendamentos.png";
import illustrationConvencoes from "@/assets/mobile/illustration-convencoes.png";
import illustrationDeclaracoes from "@/assets/mobile/illustration-declaracoes.png";
import illustrationConvenios from "@/assets/mobile/illustration-convenios.png";
import illustrationBoletos from "@/assets/mobile/illustration-boletos.png";
import illustrationDiretoria from "@/assets/mobile/illustration-diretoria.png";
import illustrationDocumentos from "@/assets/mobile/illustration-documentos.png";
import illustrationAtendimentos from "@/assets/mobile/illustration-atendimentos.png";
import illustrationOuvidoria from "@/assets/mobile/illustration-ouvidoria.png";
import illustrationJuridico from "@/assets/mobile/illustration-juridico.png";

export function MobileServiceGrid() {
  const navigate = useNavigate();
  const { isTabActive, loading } = useMobileAppTabs();

  const allServices = [
    { 
      key: "agendamentos",
      image: illustrationAgendamentos, 
      label: "Agendamentos", 
      onClick: () => navigate("/app/agendamentos") 
    },
    { 
      key: "agendamento-juridico",
      image: illustrationJuridico, 
      label: "Agend. Jurídico",
      onClick: () => navigate("/app/agendar-juridico") 
    },
    { 
      key: "convencoes",
      image: illustrationConvencoes, 
      label: "Convenções",
      onClick: () => navigate("/app/servicos/convencoes") 
    },
    { 
      key: "declaracoes",
      image: illustrationDeclaracoes, 
      label: "Declarações",
      onClick: () => navigate("/app/servicos/declaracoes") 
    },
    { 
      key: "convenios",
      image: illustrationConvenios, 
      label: "Convênios",
      onClick: () => navigate("/app/servicos/convenios") 
    },
    { 
      key: "boletos",
      image: illustrationBoletos, 
      label: "Boletos",
      onClick: () => navigate("/app/servicos/boletos") 
    },
    { 
      key: "diretoria",
      image: illustrationDiretoria, 
      label: "Diretoria",
      onClick: () => navigate("/app/servicos/diretoria") 
    },
    { 
      key: "documentos",
      image: illustrationDocumentos, 
      label: "Documentos",
      onClick: () => navigate("/app/servicos/documentos") 
    },
    { 
      key: "atendimentos",
      image: illustrationAtendimentos, 
      label: "Atendimentos",
      onClick: () => navigate("/app/servicos/atendimentos") 
    },
    { 
      key: "ouvidoria",
      image: illustrationOuvidoria, 
      label: "Ouvidoria",
      onClick: () => navigate("/app/servicos/ouvidoria") 
    },
  ];

  // Filter out inactive tabs
  const services = allServices.filter(service => isTabActive(service.key));

  if (loading || services.length === 0) {
    return null;
  }

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-bold text-gray-800 tracking-wide mb-3">NOSSOS SERVIÇOS</h3>
      
      <div className="grid grid-cols-3 gap-3">
        {services.map((service, idx) => (
          <button 
            key={idx} 
            onClick={service.onClick} 
            className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 shadow-sm transition-all duration-200 active:scale-95"
          >
            <div className="w-20 h-16 flex items-center justify-center">
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
