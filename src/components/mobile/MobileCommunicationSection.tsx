import { useNavigate } from "react-router-dom";
import { Image, Newspaper, Radio, Youtube } from "lucide-react";

export function MobileCommunicationSection() {
  const navigate = useNavigate();

  const items = [
    { icon: Image, label: "Galeria", color: "bg-amber-500", path: "/app/comunicacao/galeria" },
    { icon: Newspaper, label: "Jornais", color: "bg-slate-600", path: "/app/comunicacao/jornais" },
    { icon: Radio, label: "Rádios", color: "bg-emerald-500", path: "/app/comunicacao/radios" },
    { icon: Youtube, label: "Vídeos", color: "bg-red-600", path: "/app/comunicacao/videos" },
  ];

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">COMUNICAÇÃO</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => navigate(item.path)}
            className="flex-shrink-0 flex flex-col items-center gap-2"
          >
            <div className={`w-14 h-14 ${item.color} rounded-full flex items-center justify-center`}>
              <item.icon className="h-6 w-6 text-white" />
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
