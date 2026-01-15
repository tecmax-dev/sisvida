import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { MobileCarousel } from "@/components/mobile/MobileCarousel";
import { MobileServiceGrid } from "@/components/mobile/MobileServiceGrid";
import { MobileFeaturedServices } from "@/components/mobile/MobileFeaturedServices";
import { MobileCommunicationSection } from "@/components/mobile/MobileCommunicationSection";
import { MobileHelpSection } from "@/components/mobile/MobileHelpSection";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { Loader2, Sparkles, Award } from "lucide-react";

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

export default function MobileHomePage() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPatientData();
  }, []);

  const loadPatientData = async () => {
    try {
      const patientId = sessionStorage.getItem('mobile_patient_id');
      
      if (!patientId) {
        navigate("/app/login");
        return;
      }

      // Fetch patient data
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("id, name, email, phone, photo_url, registration_number, is_active, no_show_blocked_until")
        .eq("id", patientId)
        .single();

      if (patientError || !patientData) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus dados.",
          variant: "destructive",
        });
        navigate("/app/login");
        return;
      }

      setPatient(patientData);

      // Fetch dependents count
      const { count } = await supabase
        .from("patient_dependents")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", patientId)
        .eq("is_active", true);

      setDependentsCount(count || 0);
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      setLoading(false);
    }
  };

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
      {/* Welcome Card - Premium design */}
      <div className="mx-4 mt-5">
        <div className="bg-white rounded-3xl p-5 shadow-xl shadow-emerald-500/10 border border-gray-100/50 relative overflow-hidden">
          {/* Decorative gradient blob */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-emerald-200/50 to-teal-200/50 rounded-full blur-2xl" />
          
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-100 to-teal-100 flex-shrink-0 shadow-lg shadow-emerald-500/20">
              {patient?.photo_url ? (
                <img 
                  src={patient.photo_url} 
                  alt={patient.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-2xl">
                  {firstName.charAt(0)}
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  Associado
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                Olá, {firstName} <span className="text-2xl">👋</span>
              </h2>
              <p className="text-sm text-gray-500">Que bom ter você conosco!</p>
            </div>
          </div>
          
          {/* Status bar */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-gray-500">Conta ativa</span>
            </div>
            {patient?.registration_number && (
              <span className="text-xs font-mono text-gray-400">
                Nº {patient.registration_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Featured Services */}
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
