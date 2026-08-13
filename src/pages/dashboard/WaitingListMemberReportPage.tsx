import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ArrowLeft, Download, FileText, Loader2, Search, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type PatientOption = { id: string; name: string; cpf: string | null; registration_number: string | null };

export default function WaitingListMemberReportPage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;

  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<PatientOption | null>(null);

  const { data: results, isFetching: searching } = useQuery({
    queryKey: ["wl-member-search", clinicId, term],
    enabled: !!clinicId && term.trim().length >= 3 && !selected,
    queryFn: async () => {
      const raw = term.trim();
      const digits = raw.replace(/\D/g, "");
      let query = supabase
        .from("patients")
        .select("id, name, cpf, registration_number")
        .eq("clinic_id", clinicId!)
        .limit(20);
      query = digits.length >= 3
        ? query.or(`cpf.ilike.%${digits}%,name.ilike.%${raw}%,registration_number.ilike.%${digits}%`)
        : query.ilike("name", `%${raw}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PatientOption[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["wl-member-report", clinicId, selected?.id],
    enabled: !!clinicId && !!selected?.id,
    queryFn: async () => {
      const [{ data: logs }, { data: queues }] = await Promise.all([
        supabase
          .from("waiting_list_logs")
          .select("id, action, actor_type, actor_id, details, created_at, waiting_list_id, patient_id, professional_id")
          .eq("clinic_id", clinicId!)
          .eq("patient_id", selected!.id)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("waiting_list")
          .select("id, queue_status, queue_position, entered_at, is_active, professional_id")
          .eq("clinic_id", clinicId!)
          .eq("patient_id", selected!.id)
          .order("entered_at", { ascending: false }),
      ]);

      const rows = (logs ?? []) as unknown as LogRow[];
      const queueRows = (queues ?? []) as any[];
      const professionalIds = Array.from(new Set([
        ...rows.map((r) => r.professional_id),
        ...queueRows.map((q) => q.professional_id),
      ].filter(Boolean))) as string[];
      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];

      const [professionals, profiles] = await Promise.all([
        professionalIds.length
          ? supabase.from("professionals").select("id, name").in("id", professionalIds)
          : Promise.resolve({ data: [] as any[] }),
        actorIds.length
          ? supabase.from("profiles").select("user_id, name, email").in("user_id", actorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const professionalMap = new Map((professionals.data ?? []).map((p: any) => [p.id, p.name]));
      const actorMap = new Map((profiles.data ?? []).map((p: any) => [p.user_id, p.name || p.email]));
      return { rows, queueRows, professionalMap, actorMap };
    },
  });

  const tableRows = useMemo(() => (data?.rows ?? []).map((r) => ([
    new Date(r.created_at).toLocaleString("pt-BR"),
    ACTION_LABEL[r.action] ?? r.action,
    data?.professionalMap.get(r.professional_id ?? "") ?? "Sem preferência",
    r.actor_id ? (data?.actorMap.get(r.actor_id) ?? "Usuário removido") : (ACTOR_LABEL[r.actor_type] ?? r.actor_type),
    ACTOR_LABEL[r.actor_type] ?? r.actor_type,
    describeDetails(r.action, r.details),
  ])), [data]);

  const exportPdf = () => {
    if (!selected) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Histórico do Associado na Fila de Espera", 14, 14);
    doc.setFontSize(9);
    doc.text(`${currentClinic?.name ?? ""} · Associado: ${selected.name}${selected.cpf ? ` · CPF ${selected.cpf}` : ""}`, 14, 20);
    doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, 14, 25);

    const queueBody = (data?.queueRows ?? []).map((q) => ([
      data?.professionalMap.get(q.professional_id ?? "") ?? "Sem preferência",
      STATUS_LABEL[q.queue_status] ?? q.queue_status,
      q.queue_position ?? "—",
      q.entered_at ? new Date(q.entered_at).toLocaleString("pt-BR") : "—",
    ]));
    autoTable(doc, {
      startY: 30,
      head: [["Profissional", "Situação", "Posição", "Entrou em"]],
      body: queueBody.length ? queueBody : [["—", "—", "—", "—"]],
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [9, 71, 152] },
    });
    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY ?? 40) + 6,
      head: [["Data/Hora", "Ação", "Profissional", "Responsável", "Origem", "Detalhes"]],
      body: tableRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [9, 71, 152] },
      columnStyles: { 5: { cellWidth: 70 } },
    });
    doc.save(`fila-espera-${selected.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  const exportCsv = () => {
    if (!selected) return;
    const header = ["Data/Hora", "Ação", "Profissional", "Responsável", "Origem", "Detalhes"];
    const csv = [header, ...tableRows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fila-espera-${selected.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link to="/dashboard/fila-espera" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Histórico do Associado na Fila</h1>
            <p className="text-sm text-muted-foreground">
              Em quais profissionais o associado entrou na fila e todas as ações (ofertas, confirmações,
              recusas, cancelamentos, exclusões) com usuário responsável e data/hora.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!selected || !tableRows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button onClick={exportPdf} disabled={!selected}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buscar associado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome, CPF ou matrícula</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Digite ao menos 3 caracteres..."
                value={term}
                onChange={(e) => { setTerm(e.target.value); setSelected(null); }}
              />
            </div>
          </div>

          {selected ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{selected.name}</span>
              {selected.cpf && <Badge variant="outline" className="text-xs">CPF {selected.cpf}</Badge>}
              {selected.registration_number && (
                <Badge variant="outline" className="text-xs">Matrícula {selected.registration_number}</Badge>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setSelected(null); setTerm(""); }}>
                Trocar
              </Button>
            </div>
          ) : searching ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (results?.length ?? 0) > 0 ? (
            <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {results!.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
                  onClick={() => setSelected(p)}
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.cpf ? `CPF ${p.cpf}` : "Sem CPF"}
                    {p.registration_number ? ` · Matrícula ${p.registration_number}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : term.trim().length >= 3 ? (
            <p className="text-sm text-muted-foreground">Nenhum associado encontrado.</p>
          ) : null}
        </CardContent>
      </Card>

      {selected && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filas por profissional</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (data?.queueRows.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Este associado nunca entrou na fila de espera.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Posição</TableHead>
                        <TableHead>Entrou em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.queueRows.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell className="text-sm">
                            {data?.professionalMap.get(q.professional_id ?? "") ?? "Sem preferência"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={q.is_active ? "default" : "secondary"} className="text-xs">
                              {STATUS_LABEL[q.queue_status] ?? q.queue_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{q.queue_position ?? "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {q.entered_at ? new Date(q.entered_at).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Linha do tempo de ações</span>
                <Badge variant="secondary">{data?.rows.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (data?.rows.length ?? 0) === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma ação registrada para este associado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {new Date(r.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{ACTION_LABEL[r.action] ?? r.action}</TableCell>
                          <TableCell className="text-sm">
                            {data?.professionalMap.get(r.professional_id ?? "") ?? "Sem preferência"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.actor_id ? (data?.actorMap.get(r.actor_id) ?? "Usuário removido") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{ACTOR_LABEL[r.actor_type] ?? r.actor_type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                            {describeDetails(r.action, r.details)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
