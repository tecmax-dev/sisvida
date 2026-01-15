import { useNavigate } from "react-router-dom";
import { Users, Lock, CreditCard, ChevronRight } from "lucide-react";

interface Props {
  dependentsCount: number;
  registrationNumber: string | null;
}

export function MobileFeaturedServices({ dependentsCount, registrationNumber }: Props) {
  const navigate = useNavigate();

  const services = [
    { 
      icon: Users, 
      label: "Dependentes", 
      description: `${dependentsCount} cadastrados`,
      gradient: "from-violet-500 to-purple-600",
      shadowColor: "shadow-violet-500/25",
      bgLight: "bg-violet-50",
      onClick: () => navigate("/app/dependentes") 
    },
    { 
      icon: Lock, 
      label: "Alterar senha",
      description: "Segurança da conta",
      gradient: "from-amber-500 to-orange-500",
      shadowColor: "shadow-amber-500/25",
      bgLight: "bg-amber-50",
      onClick: () => navigate("/app/alterar-senha") 
    },
    { 
      icon: CreditCard, 
      label: "Carteirinha",
      description: "Documento digital",
      gradient: "from-emerald-500 to-teal-500",
      shadowColor: "shadow-emerald-500/25",
      bgLight: "bg-emerald-50",
      onClick: () => navigate("/app/carteirinha") 
    },
  ];

  return (
    <section className="px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800 tracking-wide">ACESSO RÁPIDO</h3>
        <div className="h-1 w-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" />
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {services.map((service, idx) => (
          <button 
            key={idx} 
            onClick={service.onClick} 
            className={`flex-shrink-0 w-32 bg-white rounded-2xl p-4 flex flex-col items-center gap-3 shadow-lg ${service.shadowColor} border border-gray-100/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div className={`w-14 h-14 bg-gradient-to-br ${service.gradient} rounded-2xl flex items-center justify-center shadow-lg ${service.shadowColor}`}>
              <service.icon className="h-7 w-7 text-white drop-shadow-sm" />
            </div>
            <div className="text-center">
              <span className="text-sm font-semibold text-gray-800 block">{service.label}</span>
              <span className="text-[10px] text-gray-500 font-medium">{service.description}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
