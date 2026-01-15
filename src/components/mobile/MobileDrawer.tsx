import { useNavigate } from "react-router-dom";
import { X, Users, CreditCard, Lock, HelpCircle, Info, Star, Share2, LogOut, ChevronRight, Sparkles, UserCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    name: string;
    email: string | null;
    photo_url: string | null;
  } | null;
}

export function MobileDrawer({ open, onOpenChange, patient }: MobileDrawerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const firstName = patient?.name?.split(" ")[0] || "Sócio";

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("mobile_patient_id");
    sessionStorage.removeItem("mobile_clinic_id");
    onOpenChange(false);
    navigate("/app/login");
    toast({
      title: "Até logo!",
      description: "Você saiu do aplicativo.",
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "SECMI - Sindicato dos Comerciários",
          text: "Baixe o aplicativo do SECMI",
          url: window.location.origin + "/app",
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      toast({
        title: "Compartilhar",
        description: "Funcionalidade não suportada neste dispositivo.",
      });
    }
    onOpenChange(false);
  };

  const handleRate = () => {
    toast({
      title: "Avaliar aplicativo",
      description: "Funcionalidade em desenvolvimento.",
    });
    onOpenChange(false);
  };

  const menuItems = [
    { 
      icon: Users, 
      label: "Dependentes", 
      description: "Gerencie seus dependentes",
      gradient: "from-violet-500 to-purple-600",
      onClick: () => handleNavigate("/app/dependentes") 
    },
    { 
      icon: CreditCard, 
      label: "Carteirinha", 
      description: "Sua identificação digital",
      gradient: "from-emerald-500 to-teal-600",
      onClick: () => handleNavigate("/app/carteirinha") 
    },
    { 
      icon: Lock, 
      label: "Alterar senha", 
      description: "Segurança da sua conta",
      gradient: "from-amber-500 to-orange-600",
      onClick: () => handleNavigate("/app/alterar-senha") 
    },
    { 
      icon: HelpCircle, 
      label: "Dúvidas frequentes", 
      description: "Respostas rápidas",
      gradient: "from-blue-500 to-indigo-600",
      onClick: () => handleNavigate("/app/faq") 
    },
    { 
      icon: Info, 
      label: "Sobre", 
      description: "Conheça o SECMI",
      gradient: "from-slate-500 to-slate-700",
      onClick: () => handleNavigate("/app/sobre") 
    },
  ];

  const bottomItems = [
    { 
      icon: Star, 
      label: "Avaliar o aplicativo", 
      gradient: "from-amber-400 to-yellow-500",
      onClick: handleRate 
    },
    { 
      icon: Share2, 
      label: "Compartilhar", 
      gradient: "from-blue-400 to-cyan-500",
      onClick: handleShare 
    },
    { 
      icon: LogOut, 
      label: "Sair do aplicativo", 
      gradient: "from-red-500 to-rose-600",
      onClick: handleSignOut,
      isDestructive: true
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85%] max-w-[340px] p-0 flex flex-col bg-slate-50">
        {/* Header with user info - Premium gradient */}
        <SheetHeader className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white p-5 pb-7 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/10 rounded-full" />
          
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className="w-18 h-18 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/30 shadow-xl">
                {patient?.photo_url ? (
                  <img 
                    src={patient.photo_url} 
                    alt={patient.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-300 to-teal-400 flex items-center justify-center">
                    <UserCircle className="h-12 w-12 text-white/80" />
                  </div>
                )}
              </div>
              <button 
                onClick={() => onOpenChange(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg leading-tight">{patient?.name?.toUpperCase()}</h2>
                <Sparkles className="h-4 w-4 text-amber-300" />
              </div>
              <p className="text-sm text-white/80 mt-0.5">{patient?.email}</p>
            </div>
          </div>
        </SheetHeader>

        {/* Menu Items */}
        <div className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="space-y-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-2xl transition-all duration-200 text-left group"
              >
                <div className={`w-11 h-11 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <span className="text-gray-800 font-semibold text-sm block">{item.label}</span>
                  <span className="text-gray-500 text-xs">{item.description}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-gray-200 bg-white py-3 px-3">
          <div className="flex gap-2">
            {bottomItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
                  item.isDestructive 
                    ? 'hover:bg-red-50' 
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className={`w-9 h-9 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center shadow-md`}>
                  <item.icon className="h-4 w-4 text-white" />
                </div>
                <span className={`text-[10px] font-medium ${item.isDestructive ? 'text-red-600' : 'text-gray-600'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
