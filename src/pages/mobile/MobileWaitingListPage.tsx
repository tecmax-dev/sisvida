import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Loader2, CheckCircle2, XCircle, ListOrdered } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
import { useToast } from "@/hooks/use-toast";

type Queue = {
  id: string;
  clinic_id: string;
  professional_id: string | null;
  queue_status: string;
  entered_at: string;
  live_position: number | null;
  offered_appointment_date: string | null;
  offered_appointment_time: string | null;
  professional?: { id: string; name: string } | null;
};

type Offer = {
  id: string;
  clinic_id: string;
  waiting_list_id: string;
  appointment_date: string;
  start_time: string;
  expires_at: string;
  status: string;
};

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  ATIVO: { label: "Aguardando", variant: "secondary" },
  OFERTADO: { label: "Oferta recebida", variant: "default" },
  ACEITO: { label: "Aceita", variant: "default" },
  RECUSADO: { label: "Recusada", variant: "outline" },
  EXPIRADO: { label: "Expirada", variant: "outline" },
  REMOVIDO: { label: "Removida", variant: "outline" },
};

export default function MobileWaitingListPage() {
  const navigate = useNavigate();
  const { patientId, clinicId, initialized, loading: authLoading } = useMobileAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  const load = useCallback(async () => {
    if (!initialized || authLoading) return;
    if (!patientId) {
      setQueues([]);
      setOffers([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.functions.invoke("waiting-list-patient", {
      body: { action: "list", patientId, clinicId: clinicId ?? undefined },
    });
    if (!error && data) {
      setQueues((data as any).queues ?? []);
      setOffers((data as any).offers ?? []);
    }
    setLoading(false);
  }, [patientId, clinicId, initialized, authLoading]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Relógio de 1s para o contador regressivo em tempo real
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Atualização em tempo real (fila e ofertas)
  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`wl-patient-${patientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waiting_list_offers", filter: `patient_id=eq.${patientId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "waiting_list", filter: `patient_id=eq.${patientId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, load]);

  const formatRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now;
    if (isNaN(diff)) return null;
    if (diff <= 0) return "expirada";
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const respond = async (offerId: string, action: "accept" | "decline", offerClinicId?: string | null) => {
    setBusy(offerId);
    try {
      const { data, error } = await supabase.functions.invoke("waiting-list-patient", {
        body: { action, patientId, clinicId: offerClinicId ?? clinicId, offerId },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success === false || result?.error) {
        const msg = result?.error === "slot_taken"
          ? "Esta vaga já foi ocupada por outro associado."
          : result?.error === "offer_expired"
            ? "Esta oferta expirou."
            : "Não foi possível concluir a operação.";
        toast({ title: "Ops", description: msg, variant: "destructive" });
      } else if (action === "accept") {
        toast({ title: "Consulta confirmada", description: "Sua consulta foi confirmada com sucesso." });
      } else {
        toast({ title: "Vaga recusada", description: "A vaga foi oferecida ao próximo da fila." });
      }
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const pendingOffers = offers.filter(
    (o) => o.status === "PENDENTE" && new Date(o.expires_at).getTime() > now
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate("/app/home")} className="p-1" aria-label="Voltar">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold">Minhas Filas de Espera</h1>
      </header>

      <div className="flex-1 p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {pendingOffers.map((offer) => {
              const queue = queues.find((q) => q.id === offer.waiting_list_id);
              return (
                <Card key={offer.id} className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20">
                  <CardContent className="pt-5 space-y-3">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300">Nova oportunidade de agendamento</p>
                    <p className="text-sm text-muted-foreground">Uma vaga ficou disponível.</p>
                    <div className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">Profissional:</span> {queue?.professional?.name ?? "—"}</p>
                      <p><span className="text-muted-foreground">Data:</span> {new Date(offer.appointment_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                      <p><span className="text-muted-foreground">Horário:</span> {offer.start_time?.slice(0, 5)}</p>
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Tempo restante: {formatRemaining(offer.expires_at)}
                        <span className="text-muted-foreground font-normal">
                          (até {new Date(offer.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" disabled={busy === offer.id} onClick={() => respond(offer.id, "accept", offer.clinic_id)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Aceitar vaga
                      </Button>
                      <Button variant="outline" className="flex-1" disabled={busy === offer.id} onClick={() => respond(offer.id, "decline", offer.clinic_id)}>
                        <XCircle className="h-4 w-4 mr-1" /> Recusar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {queues.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  <ListOrdered className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  Você não está em nenhuma fila de espera.
                </CardContent>
              </Card>
            ) : (
              queues.map((q) => {
                const status = STATUS[q.queue_status] ?? { label: q.queue_status, variant: "outline" as const };
                return (
                  <Card key={q.id}>
                    <CardContent className="pt-4 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{q.professional?.name ?? "Sem preferência"}</p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Entrou em {new Date(q.entered_at).toLocaleString("pt-BR")}
                      </p>
                      {q.queue_status === "ATIVO" && q.live_position && (
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          Sua posição na fila: {q.live_position}º <span className="text-muted-foreground font-normal">(atualiza automaticamente)</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}