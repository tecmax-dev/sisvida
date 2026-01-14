import { useNavigate } from "react-router-dom";
import { Calendar, FileText, Building, Receipt, Users, ClipboardList, HeadphonesIcon, MessageCircle } from "lucide-react";

export function MobileServiceGrid() {
  const navigate = useNavigate();

  const services = [
    { icon: Calendar, label: "Agendamentos", onClick: () => navigate("/app/agendamentos") },
    { icon: FileText, label: "Convenções", onClick: () => {} },
    { icon: ClipboardList, label: "Declarações", onClick: () => {} },
    { icon: Building, label: "Convênios", onClick: () => {} },
    { icon: Receipt, label: "Boletos", onClick: () => {} },
    { icon: Users, label: "Diretoria", onClick: () => {} },
    { icon: FileText, label: "Documentos", onClick: () => {} },
    { icon: HeadphonesIcon, label: "Atendimentos", onClick: () => {} },
    { icon: MessageCircle, label: "Ouvidoria", onClick: () => {} },
  ];

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">NOSSOS SERVIÇOS</h3>
      <div className="grid grid-cols-3 gap-3">
        {services.map((service, idx) => (
          <button key={idx} onClick={service.onClick} className="bg-white border rounded-xl p-3 flex flex-col items-center gap-2 shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 rounded-lg flex items-center justify-center">
              <service.icon className="h-7 w-7 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-center">{service.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
