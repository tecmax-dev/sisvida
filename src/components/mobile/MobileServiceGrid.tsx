import { useNavigate } from "react-router-dom";
import { Calendar, FileText, Building, Receipt, Users, ClipboardList, HeadphonesIcon, MessageCircle, Folder } from "lucide-react";

export function MobileServiceGrid() {
  const navigate = useNavigate();

  const services = [
    { 
      icon: Calendar, 
      label: "Agendamentos", 
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      onClick: () => navigate("/app/agendamentos") 
    },
    { 
      icon: FileText, 
      label: "Convenções",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      onClick: () => navigate("/app/servicos/convencoes") 
    },
    { 
      icon: ClipboardList, 
      label: "Declarações",
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-600",
      onClick: () => navigate("/app/servicos/declaracoes") 
    },
    { 
      icon: Building, 
      label: "Convênios",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      onClick: () => navigate("/app/servicos/convenios") 
    },
    { 
      icon: Receipt, 
      label: "Boletos",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      onClick: () => navigate("/app/servicos/boletos") 
    },
    { 
      icon: Users, 
      label: "Diretoria",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      onClick: () => navigate("/app/servicos/diretoria") 
    },
    { 
      icon: Folder, 
      label: "Documentos",
      iconBg: "bg-teal-100",
      iconColor: "text-teal-600",
      onClick: () => navigate("/app/servicos/documentos") 
    },
    { 
      icon: HeadphonesIcon, 
      label: "Atendimentos",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      onClick: () => navigate("/app/servicos/atendimentos") 
    },
    { 
      icon: MessageCircle, 
      label: "Ouvidoria",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      onClick: () => navigate("/app/servicos/ouvidoria") 
    },
  ];

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-bold text-gray-800 tracking-wide mb-4">NOSSOS SERVIÇOS</h3>
      
      <div className="grid grid-cols-3 gap-3">
        {services.map((service, idx) => (
          <button 
            key={idx} 
            onClick={service.onClick} 
            className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 shadow-sm transition-all duration-200 active:scale-95"
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
