import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { MobileCarousel } from "@/components/mobile/MobileCarousel";
import { Link } from "react-router-dom";
import { MobileCardStatus, MobilePriorityCards, MobileNextAppointment } from "@/components/mobile/home/MobileHomeHighlights";
import { MobileAllServices } from "@/components/mobile/home/MobileAllServices";
import { MobileHelpSection } from "@/components/mobile/MobileHelpSection";
import { MobileFooter } from "@/components/mobile/MobileFooter";
import { Loader2 } from "lucide-react";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
import MobileQueueCallCard from "@/components/mobile/MobileQueueCallCard";
import { DependentGenderPopup } from "@/components/mobile/DependentGenderPopup";

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

      // Aguardar a sessão Supabase estar disponível antes de consultar (RLS exige JWT).
      // Ao reabrir o app, pode haver uma corrida: patientId já foi restaurado do localStorage,
      // mas o auto-refresh do token Supabase ainda não terminou.
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        try {
          await supabase.auth.refreshSession();
        } catch (e) {
          console.warn("[MobileHome] refreshSession falhou:", e);
        }
        // Pequeno polling para aguardar o cliente sincronizar
        for (let i = 0; i < 10 && !session; i++) {
          await new Promise((r) => setTimeout(r, 200));
          session = (await supabase.auth.getSession()).data.session;
        }
      }

      // Fetch patient data com 1 retry em caso de erro transitório
      let patientData: PatientData | null = null;
      let patientError: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await supabase
          .from("patients")
          .select("id, name, email, phone, photo_url, registration_number, is_active, no_show_blocked_until")
          .eq("id", id)
          .maybeSingle();
        patientData = res.data as PatientData | null;
        patientError = res.error;
        if (patientData && !patientError) break;
        if (attempt === 0) {
          try { await supabase.auth.refreshSession(); } catch {}
          await new Promise((r) => setTimeout(r, 400));
        }
      }

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
      <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-mobile rounded-lg flex items-center justify-center shadow-lg animate-pulse">
            <Loader2 className="h-7 w-7 animate-spin text-mobile-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const firstName = patient?.name?.split(" ")[0] || "Sócio";

  return (
    <MobileLayout>
      {patient?.id && <DependentGenderPopup patientId={patient.id} />}

      <MobileQueueCallCard />

      {/* Saudação + status da carteirinha */}
      <section className="bg-mobile text-mobile-foreground px-4 pt-4 pb-10 rounded-b-[28px]">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-mobile-foreground/30">
            {patient?.photo_url ? (
              <img src={patient.photo_url} alt={patient.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-mobile-foreground/20 flex items-center justify-center font-bold text-xl">
                {firstName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight truncate">
              Olá, {firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()}! 👋
            </h2>
            <p className="text-sm opacity-85">Que bom ter você conosco</p>
          </div>
        </div>
        {patient?.id && <div className="mt-4"><MobileCardStatus patientId={patient.id} /></div>}
      </section>

      <MobilePriorityCards dependentsCount={dependentsCount} />

      {patient?.id && <MobileNextAppointment patientId={patient.id} />}

      {/* Notícias SECMI */}
      <section className="mt-6">
        <div className="px-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Notícias SECMI</h3>
          <Link to="/app/comunicacao/jornais" className="text-sm font-medium text-mobile">Ver todas</Link>
        </div>
        <MobileCarousel />
      </section>

      <MobileAllServices />

      <div className="h-4" />
      <MobileHelpSection />

      {/* Footer */}
      <MobileFooter />
    </MobileLayout>
  );
}
