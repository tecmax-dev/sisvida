import { useNavigate } from "react-router-dom";
import { Image, Newspaper, Radio, Play, LucideIcon } from "lucide-react";
import { useMobileAppTabs } from "@/hooks/useMobileAppTabs";
import { useMobileAuth, PUBLIC_TAB_KEYS } from "@/hooks/useMobileAuth";

export function MobileCommunicationSection() {
  const navigate = useNavigate();
  const { isTabActive, loading } = useMobileAppTabs();
  const { isLoggedIn } = useMobileAuth();

  const allItems: { 
    key: string;
    icon: LucideIcon; 
    label: string; 
    bgColor: string;
    path: string;
  }[] = [
    { 
      key: "galeria",
      icon: Image, 
      label: "Galeria", 
      bgColor: "bg-blue-500",
      path: "/app/comunicacao/galeria" 
    },
    { 
      key: "jornais",
      icon: Newspaper, 
      label: "Jornais", 
      bgColor: "bg-amber-500",
      path: "/app/comunicacao/jornais" 
    },
    { 
      key: "radios",
      icon: Radio, 
      label: "Rádios", 
      bgColor: "bg-emerald-500",
      path: "/app/comunicacao/radios" 
    },
    { 
      key: "videos",
      icon: Play, 
      label: "Vídeos", 
      bgColor: "bg-red-600",
      path: "/app/comunicacao/videos" 
    },
  ];

  // Filter out inactive tabs and respect login status
  // Communication items (galeria, jornais, radios, videos) are all public
  const items = allItems.filter(item => {
    if (!isTabActive(item.key)) return false;
    if (isLoggedIn) return true;
    return PUBLIC_TAB_KEYS.includes(item.key);
  });

  if (loading || items.length === 0) {
    return null;
  }

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-bold text-gray-800 tracking-wide mb-4">COMUNICAÇÃO</h3>
      
      <div className="flex justify-between px-2">
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
