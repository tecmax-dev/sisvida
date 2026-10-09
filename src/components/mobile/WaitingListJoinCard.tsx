import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, BellRing, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  professionalId: string;
  clinicId?: string | null;
  specialtyId?: string | null;
}

export function WaitingListJoinCard({ professionalId, clinicId: clinicIdProp, specialtyId }: Props) {
  const { patientId, clinicId: authClinicId, initialized, loading } = useMobileAuth();
  const clinicId = clinicIdProp || authClinicId;
  const { toast } = useToast();
  const navigate = useNavigate();

  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!initialized || loading) return;
      if (!patientId || !clinicId) { setChecking(false); return; }
      const { data, error } = await supabase.functions.invoke("waiting-list-patient", {
        body: { action: "status", patientId, clinicId },
      });
      if (error) {
        console.error("[WaitingListJoinCard] Erro ao consultar status da fila:", error);
      }
      if (active) {
        setEnabled(!error && !!(data as any)?.enabled);
        setChecking(false);
      }
    })();
    return () => { active = false; };
  }, [patientId, clinicId, initialized, loading]);

  useEffect(() => {
    setJoined(false);
    setConfirming(false);
  }, [professionalId]);

  const join = async () => {
    setJoining(true);
    try {
      const { data, error } = await supabase.functions.invoke("waiting-list-patient", {
        body: { action: "join", patientId, clinicId, professionalId, specialtyId: specialtyId ?? null },
      });
      if (error) {
        let payload: any = null;
        try { payload = await (error as any)?.context?.json?.(); } catch { /* ignore */ }
        if (payload?.error === "already_scheduled_this_month") {
          toast({
            title: "Você já atingiu o limite de consultas com este profissional",
            description:
              "O sindicato limita a quantidade de consultas com o mesmo profissional em cada período. Por isso não é possível entrar na fila de espera dele agora — você poderá entrar quando o período da sua consulta atual terminar.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(payload?.message || error.message);
      }
      const result = data as any;
      if (result?.success === false && result?.error === "already_scheduled_this_month") {
        toast({
          title: "Você já atingiu o limite de consultas com este profissional",
          description:
            "O sindicato limita a quantidade de consultas com o mesmo profissional em cada período. Por isso não é possível entrar na fila de espera dele agora — você poderá entrar quando o período da sua consulta atual terminar.",
          variant: "destructive",
        });
        return;
      }
      if (result?.success === false && result?.error === "already_in_queue") {
        setJoined(true);
        toast({ title: "Você já está na fila", description: "Acompanhe em Minhas Filas de Espera." });
        return;
      }
      if (result?.success === false) throw new Error("Não foi possível entrar na fila.");
      setJoined(true);
      toast({
        title: "Você entrou na fila de espera",
        description: "Caso ocorra uma desistência, você receberá uma notificação no aplicativo para decidir se deseja assumir a vaga.",
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setJoining(false);
    }
  };

  if (checking) {
    return (
      <div className="mt-3 rounded-lg border p-4 text-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
        Verificando fila de espera...
      </div>
    );
  }

  if (!enabled || !patientId || !clinicId) return null;

  if (joined) {
    return (
      <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center space-y-2">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
        <p className="text-sm font-medium">Você entrou na fila de espera.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/app/filas")}>
          Ver minhas filas
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border p-4 space-y-3 text-center">
      <BellRing className="h-6 w-6 text-emerald-600 mx-auto" />
      <p className="text-sm text-muted-foreground">
        Não há vagas disponíveis para este profissional. Deseja entrar na fila de espera para ser avisado
        caso ocorra alguma desistência?
      </p>
      {confirming ? (
        <div className="flex gap-2">
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={joining} onClick={join}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar na fila"}
          </Button>
          <Button variant="outline" className="flex-1" disabled={joining} onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirming(true)}>
          Entrar na fila de espera
        </Button>
      )}
    </div>
  );
}