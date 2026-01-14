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
import { Loader2 } from "lucide-react";

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const firstName = patient?.name?.split(" ")[0] || "Sócio";

  return (
    <MobileLayout>
      {/* Welcome Card */}
      <div className="bg-emerald-50 rounded-2xl p-4 mx-4 mt-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {patient?.photo_url ? (
            <img 
              src={patient.photo_url} 
              alt={patient.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xl">
              {firstName.charAt(0)}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Olá, {firstName.toUpperCase()} 👋
          </h2>
          <p className="text-sm text-muted-foreground">Que bom ter você conosco!</p>
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
