import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  ExternalLink,
  Navigation,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HelpContentData {
  organization_name: string;
  address: string;
  city_state: string;
  cep: string;
  phone: string;
  whatsapp: string;
  email: string;
  weekday_hours: string;
  saturday_hours: string;
  sunday_holiday: string;
}

const defaultContent: HelpContentData = {
  organization_name: "Sindicato SECMI",
  address: "Rua do Sindicato, 123 - Centro",
  city_state: "São Paulo - SP",
  cep: "01310-000",
  phone: "(11) 3333-4444",
  whatsapp: "(11) 99999-8888",
  email: "contato@sindicato.org.br",
  weekday_hours: "08:00 - 17:00",
  saturday_hours: "08:00 - 12:00",
  sunday_holiday: "Fechado",
};

export default function MobileHelpPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<HelpContentData>(defaultContent);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setIsLoading(true);
    try {
      // First get the user's clinic
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch patient's clinic_id using RPC or simpler query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: patientsData, error: patientError } = await (supabase as any)
        .from("patients")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1);
      
      const patientData = patientsData?.[0] as { clinic_id: string } | undefined;

      if (!patientData?.clinic_id) {
        setIsLoading(false);
        return;
      }

      // Fetch help content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", patientData.clinic_id)
        .eq("content_type", "ajuda")
        .eq("is_active", true)
        .limit(1);

      if (error) throw error;
      const contentData = data?.[0] as { metadata: Record<string, unknown> } | undefined;

      if (contentData && contentData.metadata) {
        const metadata = contentData.metadata;
        setContent({
          organization_name: (metadata.organization_name as string) || defaultContent.organization_name,
          address: (metadata.address as string) || defaultContent.address,
          city_state: (metadata.city_state as string) || defaultContent.city_state,
          cep: (metadata.cep as string) || defaultContent.cep,
          phone: (metadata.phone as string) || defaultContent.phone,
          whatsapp: (metadata.whatsapp as string) || defaultContent.whatsapp,
          email: (metadata.email as string) || defaultContent.email,
          weekday_hours: (metadata.weekday_hours as string) || defaultContent.weekday_hours,
          saturday_hours: (metadata.saturday_hours as string) || defaultContent.saturday_hours,
          sunday_holiday: (metadata.sunday_holiday as string) || defaultContent.sunday_holiday,
        });
      }
    } catch (error) {
      console.error("Error loading help content:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMap = () => {
    const address = encodeURIComponent(`${content.address}, ${content.city_state}, ${content.cep}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, "_blank");
  };

  const handleCall = (phone: string) => {
    window.open(`tel:${phone.replace(/\D/g, "")}`, "_self");
  };

  const handleEmail = () => {
    window.open(`mailto:${content.email}`, "_blank");
  };

  const handleWhatsApp = () => {
    const phone = content.whatsapp.replace(/\D/g, "");
    const phoneWithCountry = phone.startsWith("55") ? phone : `55${phone}`;
    const message = encodeURIComponent("Olá! Preciso de ajuda.");
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-emerald-600 text-white p-4 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/app/home")}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-xl font-bold">Precisa de Ajuda?</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app/home")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold">Precisa de Ajuda?</h1>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Map Card */}
        <Card className="border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="h-40 bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm text-emerald-800 font-medium">{content.organization_name}</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-base mb-2">Como chegar até nós</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {content.address}
                <br />
                {content.city_state}, {content.cep}
              </p>
              <Button
                onClick={handleOpenMap}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Ver no mapa
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-base mb-4">Informações de Contato</h3>
            
            <div className="space-y-4">
              {/* Phone */}
              <div
                className="flex items-center gap-3 cursor-pointer p-2 -m-2 rounded-lg hover:bg-gray-50"
                onClick={() => handleCall(content.phone)}
              >
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Telefone</p>
                  <p className="text-sm text-emerald-600">{content.phone}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* WhatsApp */}
              <div
                className="flex items-center gap-3 cursor-pointer p-2 -m-2 rounded-lg hover:bg-gray-50"
                onClick={handleWhatsApp}
              >
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-sm text-emerald-600">{content.whatsapp}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Email */}
              <div
                className="flex items-center gap-3 cursor-pointer p-2 -m-2 rounded-lg hover:bg-gray-50"
                onClick={handleEmail}
              >
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">E-mail</p>
                  <p className="text-sm text-emerald-600">{content.email}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Opening Hours */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-base">Horário de Atendimento</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Segunda a Sexta</span>
                <span className="font-medium">{content.weekday_hours}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sábado</span>
                <span className="font-medium">{content.saturday_hours}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Domingo e Feriados</span>
                <span className={`font-medium ${content.sunday_holiday.toLowerCase() === 'fechado' ? 'text-red-500' : ''}`}>
                  {content.sunday_holiday}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Quick Access */}
        <Card className="border shadow-sm bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-base mb-2">Dúvidas Frequentes</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Acesse nossa seção de perguntas frequentes para resolver suas dúvidas rapidamente.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/app/servicos/atendimentos")}>
              Ver perguntas frequentes
            </Button>
          </CardContent>
        </Card>

        {/* Report Problem */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-base mb-2">Encontrou algum problema?</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Se você encontrou algum erro no aplicativo ou tem sugestões de melhoria, entre em contato conosco.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/app/servicos/ouvidoria")}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com a Ouvidoria
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
