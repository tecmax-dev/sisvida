import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft, Download, FileText, Loader2, ListOrdered, Users, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type LogRow = {
  id: string;
  action: string;
  actor_type: string;
  actor_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  waiting_list_id: string | null;
  patient_id: string | null;
  professional_id: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  queue_joined: "Entrou na fila",
  queue_removed: "Removido da fila",
  record_updated: "Registro editado",
  record_deleted: "Registro excluído",
  offer_created: "Vaga ofertada",
  offer_accepted: "Oferta aceita (confirmado)",
  offer_declined: "Oferta recusada",
  offer_expired: "Oferta expirada",
  offer_slot_taken: "Vaga já ocupada",
  offer_status_changed: "Status da oferta alterado",
  offer_deleted: "Oferta excluída",
  appointment_created: "Agendamento criado",
};

const ACTOR_LABEL: Record<string, string> = {
  staff: "Usuário do painel",
  patient: "Associado (app)",
  system: "Sistema (automático)",
};

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Aguardando",
  OFERTADO: "Oferta enviada",
  ACEITO: "Aceita",
  RECUSADO: "Recusada",
  EXPIRADO: "Expirada",
  REMOVIDO: "Removido",
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function describeDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details || Object.keys(details).length === 0) return "—";
  const d = details as Record<string, any>;
  if (action === "record_updated") {
    return Object.entries(d)
      .map(([field, change]: [string, any]) => {
        const from = change?.de ?? "—";
        const to = change?.para ?? "—";
        const label = field === "queue_status" ? "status"
          : field === "queue_position" ? "posição"
          : field === "professional_id" ? "profissional"
          : field === "notes" ? "observação"
          : field === "is_active" ? "ativo"
          : field;
        const fmt = (v: any) => (typeof v === "string" && STATUS_LABEL[v]) || String(v);
        return `${label}: ${fmt(from)} → ${fmt(to)}`;
      })
      .join(" · ");
  }
  if (action === "offer_status_changed") return `${d.de ?? "—"} → ${d.para ?? "—"}`;
  if (d.reason) return String(d.reason);
  if (d.position) return `Posição ${d.position}${d.source ? ` · origem ${d.source}` : ""}`;
  if (d.date || d.appointment_date) {
    const date = String(d.date ?? d.appointment_date);
    const time = d.start_time ? String(d.start_time).slice(0, 5) : "";
    return `${date.split("-").reverse().join("/")} ${time}`.trim();
  }
  return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(" · ");
}

export default function WaitingListReportPage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;

  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [action, setAction] = useState("all");
  const [actorType, setActorType] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["wl-report", clinicId, from, to],
    enabled: !!clinicId,
    queryFn: async () => {
      const start = `${from}T00:00:00`;
      const end = `${to}T23:59:59`;

      const [{ data: logs }, { data: queues }] = await Promise.all([
        supabase
          .from("waiting_list_logs")
          .select("id, action, actor_type, actor_id, details, created_at, waiting_list_id, patient_id, professional_id")
          .eq("clinic_id", clinicId!)
          .gte("created_at", start)
          .lte("created_at", end)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("waiting_list")
          .select("id, queue_status, entered_at, patient_id, professional_id")
          .eq("clinic_id", clinicId!),
      ]);

      const rows = (logs ?? []) as unknown as LogRow[];
      const patientIds = Array.from(new Set([
        ...rows.map((r) => r.patient_id),
        ...((queues ?? []).map((q: any) => q.patient_id)),
      ].filter(Boolean))) as string[];
      const professionalIds = Array.from(new Set([
        ...rows.map((r) => r.professional_id),
        ...((queues ?? []).map((q: any) => q.professional_id)),
      ].filter(Boolean))) as string[];
      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];

      const [patients, professionals, profiles] = await Promise.all([
        patientIds.length
          ? supabase.from("patients").select("id, name").in("id", patientIds)
          : Promise.resolve({ data: [] as any[] }),
        professionalIds.length
          ? supabase.from("professionals").select("id, name").in("id", professionalIds)
          : Promise.resolve({ data: [] as any[] }),
        actorIds.length
          ? supabase.from("profiles").select("user_id, name, email").in("user_id", actorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const patientMap = new Map((patients.data ?? []).map((p: any) => [p.id, p.name]));
      const professionalMap = new Map((professionals.data ?? []).map((p: any) => [p.id, p.name]));
      const actorMap = new Map((profiles.data ?? []).map((p: any) => [p.user_id, p.name || p.email]));

      return { rows, queues: (queues ?? []) as any[], patientMap, professionalMap, actorMap };
    },
  });

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (actorType !== "all" && r.actor_type !== actorType) return false;
      if (!term) return true;
      const haystack = [
        data?.patientMap.get(r.patient_id ?? ""),
        data?.professionalMap.get(r.professional_id ?? ""),
        r.actor_id ? data?.actorMap.get(r.actor_id) : "",
        ACTION_LABEL[r.action] ?? r.action,
      ].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [data, action, actorType, search]);

  const kpis = useMemo(() => {
    const queues = data?.queues ?? [];
    const rows = data?.rows ?? [];
    const count = (a: string) => rows.filter((r) => r.action === a).length;
    return {
      active: queues.filter((q) => q.queue_status === "ATIVO").length,
      joined: count("queue_joined"),
      accepted: count("offer_accepted"),
      declined: count("offer_declined") + count("offer_expired"),
      removed: count("queue_removed") + count("record_deleted"),
      edited: count("record_updated"),
      offers: count("offer_created"),
    };
  }, [data]);

  const tableRows = useMemo(() => filtered.map((r) => ([
    new Date(r.created_at).toLocaleString("pt-BR"),
    ACTION_LABEL[r.action] ?? r.action,
    data?.patientMap.get(r.patient_id ?? "") ?? "—",
    data?.professionalMap.get(r.professional_id ?? "") ?? "Sem preferência",
    r.actor_id ? (data?.actorMap.get(r.actor_id) ?? "Usuário removido") : (ACTOR_LABEL[r.actor_type] ?? r.actor_type),
    ACTOR_LABEL[r.actor_type] ?? r.actor_type,
    describeDetails(r.action, r.details),
  ])), [filtered, data]);

  const period = `${from.split("-").reverse().join("/")} a ${to.split("-").reverse().join("/")}`;

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Relatório da Fila de Espera", 14, 14);
    doc.setFontSize(9);
    doc.text(`${currentClinic?.name ?? ""} · Período: ${period}`, 14, 20);
    doc.text(
      `Na fila: ${kpis.active} | Entradas: ${kpis.joined} | Ofertas: ${kpis.offers} | Confirmadas: ${kpis.accepted} | Recusadas/expiradas: ${kpis.declined} | Edições: ${kpis.edited} | Remoções: ${kpis.removed}`,
      14, 25,
    );
    autoTable(doc, {
      startY: 30,
      head: [["Data/Hora", "Ação", "Associado", "Profissional", "Responsável", "Origem", "Detalhes"]],
      body: tableRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [9, 71, 152] },
      columnStyles: { 6: { cellWidth: 60 } },
    });
    doc.save(`relatorio-fila-espera-${from}-${to}.pdf`);
  };

  const exportCsv = () => {
    const header = ["Data/Hora", "Ação", "Associado", "Profissional", "Responsável", "Origem", "Detalhes"];
    const csv = [header, ...tableRows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-fila-espera-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: "Na fila agora", value: kpis.active, icon: Users },
    { label: "Entradas no período", value: kpis.joined, icon: ListOrdered },
    { label: "Vagas ofertadas", value: kpis.offers, icon: Clock },
    { label: "Confirmadas", value: kpis.accepted, icon: CheckCircle2 },
    { label: "Recusadas / expiradas", value: kpis.declined, icon: XCircle },
    { label: "Edições / remoções", value: kpis.edited + kpis.removed, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link to="/dashboard/fila-espera" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Relatório da Fila de Espera</h1>
            <p className="text-sm text-muted-foreground">
              Auditoria completa: quem entrou, editou, removeu, confirmou ou recusou — com data, hora e responsável.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!tableRows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={exportPdf} disabled={!tableRows.length}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <kpi.icon className="h-3.5 w-3.5" /> {kpi.label}
              </div>
              <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ação</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="all">Todas</option>
              {Object.entries(ACTION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Origem</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={actorType}
              onChange={(e) => setActorType(e.target.value)}
            >
              <option value="all">Todas</option>
              {Object.entries(ACTOR_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              placeholder="Associado, profissional ou usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Registros</span>
            <Badge variant="secondary">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhum registro no período/filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Associado</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-sm font-medium">{ACTION_LABEL[r.action] ?? r.action}</TableCell>
                      <TableCell className="text-sm">{data?.patientMap.get(r.patient_id ?? "") ?? "—"}</TableCell>
                      <TableCell className="text-sm">{data?.professionalMap.get(r.professional_id ?? "") ?? "Sem preferência"}</TableCell>
                      <TableCell className="text-sm">
                        {r.actor_id ? (data?.actorMap.get(r.actor_id) ?? "Usuário removido") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{ACTOR_LABEL[r.actor_type] ?? r.actor_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px]">
                        {describeDetails(r.action, r.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <p className="p-3 text-xs text-muted-foreground">
                  Exibindo os 500 registros mais recentes. Exporte em PDF/CSV para ver todos ({filtered.length}).
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}