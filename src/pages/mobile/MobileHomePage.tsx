import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { MobileCarousel } from "@/components/mobile/MobileCarousel";
import { MobileServiceGrid } from "@/components/mobile/MobileServiceGrid";
import { MobileFeaturedServices } from "@/components/mobile/MobileFeaturedServices";
import { MobileCommunicationSection } from "@/components/mobile/MobileCommunicationSection";
import { MobileHelpSection } from "@/components/mobile/MobileHelpSection";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { Loader2 } from "lucide-react";
import { useMobileAuth } from "@/contexts/MobileAuthContext";

interface PatientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  registration_number: string | null;
  is_active: boolean;
  no_show_blocked_until: string | null;
}

/**
 * HOME PAGE - SEM VERIFICAÇÃO DE SESSÃO
 * 
 * A SplashScreen já decidiu que o usuário está logado.
 * Esta página apenas carrega e exibe os dados.
 */
export default function MobileHomePage() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Hook de autenticação - usado apenas para obter IDs
  const { patientId } = useMobileAuth();

  // Carregar dados do paciente quando disponível
  useEffect(() => {
    if (patientId) {
      loadPatientData(patientId);
    }
  }, [patientId]);

  const loadPatientData = async (id: string) => {
    try {
      console.log("[MobileHome] Carregando dados do paciente:", id);
      
      // Fetch patient data
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("id, name, email, phone, photo_url, registration_number, is_active, no_show_blocked_until")
        .eq("id", id)
        .single();

      if (patientError || !patientData) {
        console.error("[MobileHome] Erro ao carregar paciente:", patientError);
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus dados.",
          variant: "destructive",
        });
        return;
      }

      setPatient(patientData);

      // Fetch dependents count
      const { count } = await supabase
        .from("patient_dependents")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", id)
        .eq("is_active", true);

      setDependentsCount(count || 0);
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading enquanto carrega dados
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30 animate-pulse">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
          <p className="text-sm font-medium text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  const firstName = patient?.name?.split(" ")[0] || "Sócio";

  return (
    <MobileLayout>
      {/* Welcome Card */}
      <div className="mx-4 mt-4">
        <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {patient?.photo_url ? (
              <img 
                src={patient.photo_url} 
                alt={patient.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xl">
                {firstName.charAt(0)}
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800">
              Olá, {firstName.toUpperCase()} 👋
            </h2>
            <p className="text-sm text-gray-500">Que bom ter você conosco!</p>
          </div>
        </div>
      </div>

      {/* Featured Services - Quick access */}
      <MobileFeaturedServices 
        dependentsCount={dependentsCount}
        registrationNumber={patient?.registration_number}
      />

      {/* Carousel Banners */}
      <MobileCarousel />

      {/* Services Grid */}
      <MobileServiceGrid />

      {/* Communication Section */}
      <MobileCommunicationSection />

      {/* Help Section */}
      <MobileHelpSection />

      {/* Footer */}
      <MobileFooter />
    </MobileLayout>
  );
}
