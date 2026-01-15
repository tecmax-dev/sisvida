import { useNavigate } from "react-router-dom";
import { Image, Newspaper, Radio, Play } from "lucide-react";

export function MobileCommunicationSection() {
  const navigate = useNavigate();

  const items = [
    { 
      icon: Image, 
      label: "Galeria", 
      bgColor: "bg-blue-500",
      path: "/app/comunicacao/galeria" 
    },
    { 
      icon: Newspaper, 
      label: "Jornais", 
      bgColor: "bg-amber-500",
      path: "/app/comunicacao/jornais" 
    },
    { 
      icon: Radio, 
      label: "Rádios", 
      bgColor: "bg-emerald-500",
      path: "/app/comunicacao/radios" 
    },
    { 
      icon: Play, 
      label: "Vídeos", 
      bgColor: "bg-red-500",
      path: "/app/comunicacao/videos" 
    },
  ];

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-bold text-gray-800 tracking-wide mb-4">COMUNICAÇÃO</h3>
      
      <div className="grid grid-cols-4 gap-4">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-2 transition-all duration-200 active:scale-95"
          >
            <div className={`w-14 h-14 ${item.bgColor} rounded-full flex items-center justify-center shadow-md`}>
              <item.icon className="h-6 w-6 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
