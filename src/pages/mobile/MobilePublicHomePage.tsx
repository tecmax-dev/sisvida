import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { MobileCarousel } from "@/components/mobile/MobileCarousel";
import { MobileCommunicationSection } from "@/components/mobile/MobileCommunicationSection";
import { MobileHelpSection } from "@/components/mobile/MobileHelpSection";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { PushNotificationSetup } from "@/components/union/PushNotificationSetup";
import { 
  LogIn,
  UserPlus,
  Info,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import illustrationDiretoria from "@/assets/mobile/illustration-diretoria.png";
import { SINDICATO_UNION_ENTITY_ID } from "@/constants/sindicato";

export default function MobilePublicHomePage() {
  const navigate = useNavigate();

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
            onClick={() => navigate(`/sindical/filiacao/${SINDICATO_UNION_ENTITY_ID}`)}
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
                Para acessar todos os serviços, faça login ou cadastre-se.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Push Notification Setup - disponível para usuários anônimos */}
      <div className="mx-4 mt-4">
        <PushNotificationSetup 
          patientId={null} 
          clinicId={null} 
          allowAnonymous={true}
        />
      </div>

      {/* Carousel Banners */}
      <MobileCarousel />

      {/* Public Services - Only Diretoria */}
      <section className="px-4 py-4">
        <h3 className="text-sm font-bold text-gray-800 tracking-wide mb-3">NOSSOS SERVIÇOS</h3>
        
        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={() => navigate("/app/servicos/diretoria")}
            className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 shadow-sm transition-all duration-200 active:scale-95"
          >
            <div className="w-20 h-16 flex items-center justify-center">
              <img 
                src={illustrationDiretoria} 
                alt="Diretoria"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xs font-medium text-gray-700 text-center leading-tight">Diretoria</span>
          </button>
        </div>
      </section>

      {/* Communication Section - All public (Galeria, Jornais, Rádios, Vídeos) */}
      <MobileCommunicationSection />

      {/* Help Section - Public */}
      <MobileHelpSection />

      {/* Footer */}
      <MobileFooter />
    </MobileLayout>
  );
}
