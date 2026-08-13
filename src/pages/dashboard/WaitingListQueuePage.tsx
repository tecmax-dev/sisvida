import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListOrdered, Loader2, Clock, Send, Trash2, History, Eye, AlertTriangle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";

type QueueRow = {
  id: string;
  patient_id: string;
  professional_id: string | null;
  queue_position: number | null;
  queue_status: string;
  entered_at: string;
  offered_appointment_date: string | null;
  offered_appointment_time: string | null;
  patient: { id: string; name: string; phone: string | null } | null;
  professional: { id: string; name: string } | null;
};

type OfferRow = {
  id: string;
  waiting_list_id: string;
  professional_id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  expires_at: string;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Aguardando",
  OFERTADO: "Oferta recebida",
  ACEITO: "Aceita",
  RECUSADO: "Recusada",
  EXPIRADO: "Expirada",
  REMOVIDO: "Removido",
};

function formatWait(from: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}min`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function WaitingListQueuePage() {
  const { currentClinic } = useAuth();
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [openProfessional, setOpenProfessional] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<QueueRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<QueueRow | null>(null);
  const [busy, setBusy] = useState(false);

  const clinicId = currentClinic?.id;

  const { data: settings } = useQuery({
    queryKey: ["wl-settings", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clinics")
        .select("waiting_list_enabled, waiting_list_offer_timeout_minutes")
        .eq("id", clinicId!)
        .maybeSingle();
      return data as any;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["wl-queues", clinicId],
    enabled: !!clinicId,
    refetchInterval: 30000,
    queryFn: async () => {
      const [{ data: queues }, { data: offers }] = await Promise.all([
        supabase
          .from("waiting_list")
          .select("id, patient_id, professional_id, queue_position, queue_status, entered_at, offered_appointment_date, offered_appointment_time, patient:patients!waiting_list_patient_id_fkey(id, name, phone), professional:professionals!waiting_list_professional_id_fkey(id, name)")
          .eq("clinic_id", clinicId!)
          .order("entered_at", { ascending: true }),
        supabase
          .from("waiting_list_offers")
          .select("id, waiting_list_id, professional_id, patient_id, appointment_date, start_time, end_time, expires_at, status")
          .eq("clinic_id", clinicId!)
          .order("offered_at", { ascending: false }),
      ]);
      return {
        queues: (queues ?? []) as unknown as QueueRow[],
        offers: (offers ?? []) as unknown as OfferRow[],
      };
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["wl-logs", historyFor?.id],
    enabled: !!historyFor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("waiting_list_logs")
        .select("id, action, actor_type, details, created_at")
        .eq("waiting_list_id", historyFor!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const groups = useMemo(() => {
    const queues = data?.queues ?? [];
    const offers = data?.offers ?? [];
    const map = new Map<string, {
      professionalId: string;
      professionalName: string;
      active: QueueRow[];
      all: QueueRow[];
      pending: number;
      expired: number;
    }>();

    for (const q of queues) {
      const key = q.professional_id ?? "any";
      const name = q.professional?.name ?? "Sem preferência de profissional";
      if (!map.has(key)) {
        map.set(key, { professionalId: key, professionalName: name, active: [], all: [], pending: 0, expired: 0 });
      }
      const group = map.get(key)!;
      group.all.push(q);
      if (q.queue_status === "ATIVO") group.active.push(q);
    }

    for (const o of offers) {
      const group = map.get(o.professional_id);
      if (!group) continue;
      if (o.status === "PENDENTE") group.pending += 1;
      if (o.status === "EXPIRADA") group.expired += 1;
    }

    const term = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((g) => !term || g.professionalName.toLowerCase().includes(term))
      .sort((a, b) => b.active.length - a.active.length);
  }, [data, search]);

  const handleRemove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      const { data: result, error } = await supabase.rpc("wl_remove_from_queue", {
        p_waiting_list_id: removeTarget.id,
        p_reason: "Removido pelo painel administrativo",
      });
      if (error) throw error;
      if (!(result as any)?.success) throw new Error((result as any)?.error === "forbidden"
        ? "Apenas administradores podem remover da fila."
        : "Não foi possível remover da fila.");
      toast({ title: "Removido da fila", description: `${removeTarget.patient?.name} saiu da fila de espera.` });
      queryClient.invalidateQueries({ queryKey: ["wl-queues", clinicId] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
      setRemoveTarget(null);
    }
  };

  const handleResend = async (entry: QueueRow) => {
    const offer = (data?.offers ?? []).find((o) => o.waiting_list_id === entry.id);
    if (!offer) {
      toast({ title: "Sem oferta anterior", description: "Não há vaga registrada para reenviar.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("waiting-list-offer", {
        body: {
          clinicId,
          professionalId: offer.professional_id,
          appointmentDate: offer.appointment_date,
          startTime: offer.start_time,
          endTime: offer.end_time,
          cancelledAppointmentId: null,
        },
      });
      if (error) throw error;
      toast({ title: "Oferta reenviada", description: "A vaga foi ofertada ao primeiro da fila." });
      queryClient.invalidateQueries({ queryKey: ["wl-queues", clinicId] });
    } catch (err: any) {
      toast({ title: "Erro ao reenviar", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListOrdered className="h-6 w-6 text-primary" />
            Fila de Espera
          </h1>
          <p className="text-muted-foreground text-sm">
            Ordem de chegada (FIFO) por profissional, ofertas de vaga e histórico.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={settings?.waiting_list_enabled ? "default" : "secondary"}>
            {settings?.waiting_list_enabled ? "Fila automática ativada" : "Fila automática desativada"}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/fila-espera/associado">
              <FileText className="h-4 w-4 mr-1" /> Histórico por associado
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/fila-espera/relatorio">
              <FileText className="h-4 w-4 mr-1" /> Relatório e auditoria
            </Link>
          </Button>
        </div>
      </div>

      {!settings?.waiting_list_enabled && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
            <span>
              A Fila de Espera Automática está desativada. Ative em Configurações → Fila de Espera para que
              cancelamentos gerem ofertas automáticas.
            </span>
          </CardContent>
        </Card>
      )}

      <Input
        placeholder="Buscar profissional..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum associado na fila de espera.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => {
            const first = group.active[0];
            const avgWait = group.active.length
              ? Math.round(group.active.reduce((acc, q) => acc + (Date.now() - new Date(q.entered_at).getTime()), 0) / group.active.length / 60000)
              : 0;
            const isOpen = openProfessional === group.professionalId;
            return (
              <Card key={group.professionalId}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">{group.professionalName}</CardTitle>
                      <CardDescription className="text-xs">
                        {group.active.length} na fila · Primeiro: {first?.patient?.name ?? "—"} · Espera média: {avgWait} min
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{group.pending} oferta(s) pendente(s)</Badge>
                      <Badge variant="outline">{group.expired} expirada(s)</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setOpenProfessional(isOpen ? null : group.professionalId)}>
                        <Eye className="h-4 w-4 mr-1" />{isOpen ? "Ocultar" : "Visualizar"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-2">
                    {group.all.map((entry, index) => (
                      <div key={entry.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {entry.queue_status === "ATIVO"
                              ? `${group.active.findIndex((a) => a.id === entry.id) + 1}º `
                              : ""}
                            {entry.patient?.name ?? "Associado"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Entrou em {new Date(entry.entered_at).toLocaleString("pt-BR")} · espera {formatWait(entry.entered_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={entry.queue_status === "ATIVO" ? "secondary" : "outline"}>
                            {STATUS_LABEL[entry.queue_status] ?? entry.queue_status}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => setHistoryFor(entry)}>
                            <History className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleResend(entry)} title="Reenviar oferta">
                                <Send className="h-4 w-4" />
                              </Button>
                              {["ATIVO", "OFERTADO"].includes(entry.queue_status) && (
                                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => setRemoveTarget(entry)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {group.all.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum registro para este profissional.</p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico da fila</DialogTitle>
            <DialogDescription>{historyFor?.patient?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {(logs ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro.</p>}
            {(logs ?? []).map((log: any) => (
              <div key={log.id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{log.action}</p>
                <p className="text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")} · {log.actor_type}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da fila de espera?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.patient?.name} será removido da fila. A ordem dos demais permanece inalterada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}