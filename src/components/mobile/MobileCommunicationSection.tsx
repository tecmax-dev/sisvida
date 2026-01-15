import { useNavigate } from "react-router-dom";
import { Image, Newspaper, Radio, Youtube, Play } from "lucide-react";

export function MobileCommunicationSection() {
  const navigate = useNavigate();

  const items = [
    { 
      icon: Image, 
      label: "Galeria", 
      gradient: "from-amber-400 via-orange-500 to-rose-500",
      shadowColor: "shadow-orange-500/30",
      path: "/app/comunicacao/galeria" 
    },
    { 
      icon: Newspaper, 
      label: "Jornais", 
      gradient: "from-slate-600 via-slate-700 to-slate-800",
      shadowColor: "shadow-slate-600/30",
      path: "/app/comunicacao/jornais" 
    },
    { 
      icon: Radio, 
      label: "Rádios", 
      gradient: "from-emerald-400 via-emerald-500 to-teal-600",
      shadowColor: "shadow-emerald-500/30",
      path: "/app/comunicacao/radios" 
    },
    { 
      icon: Play, 
      label: "Vídeos", 
      gradient: "from-red-500 via-red-600 to-rose-600",
      shadowColor: "shadow-red-500/30",
      path: "/app/comunicacao/videos" 
    },
  ];

  return (
    <section className="px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800 tracking-wide">COMUNICAÇÃO</h3>
        <div className="h-1 w-12 bg-gradient-to-r from-amber-500 to-rose-500 rounded-full" />
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => navigate(item.path)}
            className="flex-shrink-0 flex flex-col items-center gap-2.5 group"
          >
            <div className={`w-16 h-16 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center shadow-lg ${item.shadowColor} group-hover:scale-110 group-active:scale-95 transition-all duration-300`}>
              <item.icon className="h-7 w-7 text-white drop-shadow-sm" />
            </div>
            <span className="text-xs font-semibold text-gray-700">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
