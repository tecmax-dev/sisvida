import { useNavigate } from "react-router-dom";
import { Users, Lock, CreditCard } from "lucide-react";

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
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      onClick: () => navigate("/app/dependentes") 
    },
    { 
      icon: Lock, 
      label: "Alterar senha",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      onClick: () => navigate("/app/alterar-senha") 
    },
    { 
      icon: CreditCard, 
      label: "Carteirinha",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      onClick: () => navigate("/app/carteirinha") 
    },
  ];

  return (
    <section className="px-4 py-4">
      <div className="grid grid-cols-3 gap-3">
        {services.map((service, idx) => (
          <button 
            key={idx} 
            onClick={service.onClick} 
            className="bg-white rounded-xl p-3 flex flex-col items-center gap-2 shadow-sm border border-gray-100 transition-all duration-200 active:scale-95"
          >
            <div className={`w-16 h-16 ${service.iconBg} rounded-xl flex items-center justify-center`}>
              <service.icon className={`h-8 w-8 ${service.iconColor}`} />
            </div>
            <span className="text-xs font-medium text-gray-700 text-center leading-tight">{service.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
