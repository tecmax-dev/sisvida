import { useNavigate } from "react-router-dom";
import illustrationAgendamentos from "@/assets/mobile/illustration-agendamentos.png";
import illustrationConvencoes from "@/assets/mobile/illustration-convencoes.png";
import illustrationDeclaracoes from "@/assets/mobile/illustration-declaracoes.png";
import illustrationConvenios from "@/assets/mobile/illustration-convenios.png";
import illustrationBoletos from "@/assets/mobile/illustration-boletos.png";
import illustrationDiretoria from "@/assets/mobile/illustration-diretoria.png";
import illustrationDocumentos from "@/assets/mobile/illustration-documentos.png";
import illustrationAtendimentos from "@/assets/mobile/illustration-atendimentos.png";
import illustrationOuvidoria from "@/assets/mobile/illustration-ouvidoria.png";

export function MobileServiceGrid() {
  const navigate = useNavigate();

  const services = [
    { 
      image: illustrationAgendamentos, 
      label: "Agendamentos", 
      onClick: () => navigate("/app/agendamentos") 
    },
    { 
      image: illustrationConvencoes, 
      label: "Convenções",
      onClick: () => navigate("/app/servicos/convencoes") 
    },
    { 
      image: illustrationDeclaracoes, 
      label: "Declarações",
      onClick: () => navigate("/app/servicos/declaracoes") 
    },
    { 
      image: illustrationConvenios, 
      label: "Convênios",
      onClick: () => navigate("/app/servicos/convenios") 
    },
    { 
      image: illustrationBoletos, 
      label: "Boletos",
      onClick: () => navigate("/app/servicos/boletos") 
    },
    { 
      image: illustrationDiretoria, 
      label: "Diretoria",
      onClick: () => navigate("/app/servicos/diretoria") 
    },
    { 
      image: illustrationDocumentos, 
      label: "Documentos",
      onClick: () => navigate("/app/servicos/documentos") 
    },
    { 
      image: illustrationAtendimentos, 
      label: "Atendimentos",
      onClick: () => navigate("/app/servicos/atendimentos") 
    },
    { 
      image: illustrationOuvidoria, 
      label: "Ouvidoria",
      onClick: () => navigate("/app/servicos/ouvidoria") 
    },
  ];

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
