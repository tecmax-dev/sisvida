import { useNavigate } from "react-router-dom";
import { Calendar, FileText, Building, Receipt, Users, ClipboardList, HeadphonesIcon, MessageCircle, Folder } from "lucide-react";

export function MobileServiceGrid() {
  const navigate = useNavigate();

  const services = [
    { 
      icon: Calendar, 
      label: "Agendamentos", 
      gradient: "from-blue-500 to-blue-600",
      bgLight: "bg-blue-50",
      iconColor: "text-blue-600",
      onClick: () => navigate("/app/agendamentos") 
    },
    { 
      icon: FileText, 
      label: "Convenções",
      gradient: "from-indigo-500 to-indigo-600",
      bgLight: "bg-indigo-50",
      iconColor: "text-indigo-600",
      onClick: () => navigate("/app/servicos/convencoes") 
    },
    { 
      icon: ClipboardList, 
      label: "Declarações",
      gradient: "from-cyan-500 to-cyan-600",
      bgLight: "bg-cyan-50",
      iconColor: "text-cyan-600",
      onClick: () => navigate("/app/servicos/declaracoes") 
    },
    { 
      icon: Building, 
      label: "Convênios",
      gradient: "from-purple-500 to-purple-600",
      bgLight: "bg-purple-50",
      iconColor: "text-purple-600",
      onClick: () => navigate("/app/servicos/convenios") 
    },
    { 
      icon: Receipt, 
      label: "Boletos",
      gradient: "from-emerald-500 to-emerald-600",
      bgLight: "bg-emerald-50",
      iconColor: "text-emerald-600",
      onClick: () => navigate("/app/servicos/boletos") 
    },
    { 
      icon: Users, 
      label: "Diretoria",
      gradient: "from-rose-500 to-rose-600",
      bgLight: "bg-rose-50",
      iconColor: "text-rose-600",
      onClick: () => navigate("/app/servicos/diretoria") 
    },
    { 
      icon: Folder, 
      label: "Documentos",
      gradient: "from-amber-500 to-amber-600",
      bgLight: "bg-amber-50",
      iconColor: "text-amber-600",
      onClick: () => navigate("/app/servicos/documentos") 
    },
    { 
      icon: HeadphonesIcon, 
      label: "Atendimento",
      gradient: "from-teal-500 to-teal-600",
      bgLight: "bg-teal-50",
      iconColor: "text-teal-600",
      onClick: () => navigate("/app/servicos/atendimentos") 
    },
    { 
      icon: MessageCircle, 
      label: "Ouvidoria",
      gradient: "from-pink-500 to-pink-600",
      bgLight: "bg-pink-50",
      iconColor: "text-pink-600",
      onClick: () => navigate("/app/servicos/ouvidoria") 
    },
  ];

  return (
    <section className="px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800 tracking-wide">NOSSOS SERVIÇOS</h3>
        <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {services.map((service, idx) => (
          <button 
            key={idx} 
            onClick={service.onClick} 
            className="bg-white border border-gray-100/80 rounded-2xl p-3 flex flex-col items-center gap-2.5 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className={`w-12 h-12 ${service.bgLight} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
              <service.icon className={`h-6 w-6 ${service.iconColor}`} />
            </div>
            <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">{service.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
