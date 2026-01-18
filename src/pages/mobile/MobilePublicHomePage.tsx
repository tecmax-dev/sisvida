import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { MobileCarousel } from "@/components/mobile/MobileCarousel";
import { MobileCommunicationSection } from "@/components/mobile/MobileCommunicationSection";
import { MobileHelpSection } from "@/components/mobile/MobileHelpSection";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { 
  Calendar, 
  Info, 
  HelpCircle, 
  MessageCircle, 
  LogIn,
  UserPlus,
  Stethoscope,
  Building,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function MobilePublicHomePage() {
  const navigate = useNavigate();

  const publicServices = [
    {
      icon: Calendar,
      title: "Agendar Consulta",
      description: "Agende sua consulta",
      onClick: () => navigate("/app/agendar"),
      color: "bg-blue-500"
    },
    {
      icon: Stethoscope,
      title: "Serviços",
      description: "Conheça nossos serviços",
      onClick: () => navigate("/app/servicos"),
      color: "bg-emerald-500"
    },
    {
      icon: Building,
      title: "Sobre",
      description: "Conheça o sindicato",
      onClick: () => navigate("/app/sobre"),
      color: "bg-purple-500"
    },
    {
      icon: HelpCircle,
      title: "FAQ",
      description: "Perguntas frequentes",
      onClick: () => navigate("/app/faq"),
      color: "bg-orange-500"
    },
    {
      icon: Phone,
      title: "Contato",
      description: "Fale conosco",
      onClick: () => navigate("/app/ajuda"),
      color: "bg-teal-500"
    },
    {
      icon: MessageCircle,
      title: "Comunicação",
      description: "Notícias e avisos",
      onClick: () => navigate("/app/comunicacao"),
      color: "bg-pink-500"
    }
  ];

  return (
    <MobileLayout showBottomNav={false}>
      {/* Header with login buttons */}
      <div className="bg-emerald-600 px-4 py-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Área Pública</h1>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={() => navigate("/app/login")}
            variant="outline"
            className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Entrar
          </Button>
          <Button
            onClick={() => navigate("/filiacao/comerciarios")}
            className="flex-1 bg-white text-emerald-700 hover:bg-gray-100"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastrar
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mx-4 mt-4">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-800 font-medium">
                Acesso limitado
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Para acessar Dependentes, Carteirinha, Agendamentos e Boletos, faça login ou cadastre-se.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Carousel Banners */}
      <MobileCarousel />

      {/* Public Services Grid */}
      <div className="px-4 py-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Serviços Disponíveis</h2>
        <div className="grid grid-cols-2 gap-3">
          {publicServices.map((service, index) => (
            <Card 
              key={index}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={service.onClick}
            >
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className={`w-12 h-12 ${service.color} rounded-xl flex items-center justify-center mb-3`}>
                  <service.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">{service.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Communication Section */}
      <MobileCommunicationSection />

      {/* Help Section */}
      <MobileHelpSection />

      {/* Footer */}
      <MobileFooter />
    </MobileLayout>
  );
}
