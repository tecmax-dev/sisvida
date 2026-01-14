import { useNavigate } from "react-router-dom";
import { X, Users, CreditCard, Lock, HelpCircle, Info, Star, Share2, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
    { icon: Users, label: "Dependentes", onClick: () => handleNavigate("/app/dependentes") },
    { icon: CreditCard, label: "Carteirinha", onClick: () => handleNavigate("/app/carteirinha") },
    { icon: Lock, label: "Alterar senha", onClick: () => handleNavigate("/app/alterar-senha") },
    { icon: HelpCircle, label: "Dúvidas frequentes", onClick: () => handleNavigate("/app/faq") },
    { icon: Info, label: "Sobre", onClick: () => handleNavigate("/app/sobre") },
  ];

  const bottomItems = [
    { icon: Star, label: "Avaliar o aplicativo", onClick: handleRate },
    { icon: Share2, label: "Compartilhar", onClick: handleShare },
    { icon: LogOut, label: "Sair do aplicativo", onClick: handleSignOut, className: "text-red-600" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85%] max-w-[320px] p-0 flex flex-col">
        {/* Header with user info */}
        <SheetHeader className="bg-emerald-600 text-white p-4 pb-6">
          <div className="flex items-start justify-between">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/20 border-2 border-white/30">
              {patient?.photo_url ? (
                <img 
                  src={patient.photo_url} 
                  alt={patient.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-emerald-400 flex items-center justify-center text-white font-bold text-2xl">
                  {firstName.charAt(0)}
                </div>
              )}
            </div>
            <button 
              onClick={() => onOpenChange(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-3">
            <h2 className="font-bold text-lg leading-tight">{patient?.name?.toUpperCase()}</h2>
            <p className="text-sm opacity-90">{patient?.email}</p>
          </div>
        </SheetHeader>

        {/* Menu Items */}
        <div className="flex-1 py-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 transition-colors text-left"
            >
              <item.icon className="h-5 w-5 text-gray-600" />
              <span className="text-gray-800 font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-gray-200 py-2">
          {bottomItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 transition-colors text-left ${item.className || ""}`}
            >
              <item.icon className={`h-5 w-5 ${item.className ? "" : "text-gray-600"}`} />
              <span className={`font-medium ${item.className || "text-gray-800"}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
