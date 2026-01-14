import { useNavigate } from "react-router-dom";
import { Users, Lock, CreditCard } from "lucide-react";

interface Props {
  dependentsCount: number;
  registrationNumber: string | null;
}

export function MobileFeaturedServices({ dependentsCount, registrationNumber }: Props) {
  const navigate = useNavigate();

  const services = [
    { icon: Users, label: "Dependentes", count: dependentsCount, onClick: () => navigate("/app/dependentes") },
    { icon: Lock, label: "Alterar senha", onClick: () => navigate("/app/alterar-senha") },
    { icon: CreditCard, label: "Carteirinha", onClick: () => navigate("/app/carteirinha") },
  ];

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">SERVIÇOS EM DESTAQUE</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {services.map((service, idx) => (
          <button key={idx} onClick={service.onClick} className="flex-shrink-0 w-28 bg-white border rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <service.icon className="h-6 w-6 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-center">{service.label}</span>
            {service.count !== undefined && (
              <span className="text-xs text-muted-foreground">{service.count} cadastrados</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
