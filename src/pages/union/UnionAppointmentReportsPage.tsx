import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  FileText,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
interface AppointmentRow {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  notes: string | null;
  patient_name: string;
  patient_phone: string | null;
  professional_name: string;
  professional_specialty: string;
  procedure_name: string | null;
  procedure_price: number | null;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
}

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Agendado", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "confirmed", label: "Confirmado", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { value: "waiting", label: "Aguardando", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "in_progress", label: "Em Atendimento", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  { value: "completed", label: "Atendido", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { value: "cancelled", label: "Cancelado", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  { value: "no_show", label: "Faltou", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
);

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.color])
);

const TYPE_LABELS: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
};

const ITEMS_PER_PAGE = 25;

export default function UnionAppointmentReportsPage() {
  const { currentClinic, session, userRoles} = useAuth();


  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [professionalId, setProfessionalId] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  // Data
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch professionals
  useEffect(() => {
    if (!resolvedClinic) return;
    supabase
      .from("professionals")
      .select("id, name, specialty")
      .eq("clinic_id", resolvedClinic.id)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setProfessionals(data);
      });
  }, [resolvedClinic]);

  const toggleStatus = (value: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const selectAllStatuses = () => {
    if (selectedStatuses.length === STATUS_OPTIONS.length) {
      setSelectedStatuses([]);
    } else {
      setSelectedStatuses(STATUS_OPTIONS.map((s) => s.value));
    }
  };

  const fetchReport = useCallback(async () => {
    if (!resolvedClinic) return;
    if (!startDate || !endDate) {
      toast.error("Informe o período (data inicial e final).");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setPage(1);

    try {
      let query = supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          status,
          type,
          notes,
          dependent_id,
          patient:patients!appointments_patient_id_fkey(name, phone),
          dependent:patient_dependents!appointments_dependent_id_fkey(name),
          professional:professionals!appointments_professional_id_fkey(name, specialty),
          procedure:procedures!appointments_procedure_id_fkey(name, price)
        `)
        .eq("clinic_id", resolvedClinic.id)
        .gte("appointment_date", startDate)
        .lte("appointment_date", endDate)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (professionalId !== "all") {
        query = query.eq("professional_id", professionalId);
      }

      if (selectedStatuses.length > 0 && selectedStatuses.length < STATUS_OPTIONS.length) {
        query = query.in("status", selectedStatuses as any);
      }

      if (startTime) {
        query = query.gte("start_time", startTime);
      }
      if (endTime) {
        query = query.lte("start_time", endTime);
      }

      const { data, error } = await query.limit(5000);
      if (error) throw error;

      let rows: AppointmentRow[] = (data || []).map((a: any) => ({
        id: a.id,
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        end_time: a.end_time,
        status: a.status,
        type: a.type,
        notes: a.notes,
        patient_name: (a.dependent_id && a.dependent?.name) ? a.dependent.name : (a.patient?.name || "—"),
        patient_phone: a.patient?.phone || null,
        professional_name: a.professional?.name || "—",
        professional_specialty: a.professional?.specialty || "—",
        procedure_name: a.procedure?.name || null,
        procedure_price: a.procedure?.price ?? null,
      }));

      // Client-side patient name filter
      if (patientSearch.trim()) {
        const search = patientSearch.trim().toLowerCase();
        rows = rows.filter((r) => r.patient_name.toLowerCase().includes(search));
      }

      setAppointments(rows);
    } catch (err) {
      console.error("Error fetching appointment report:", err);
      toast.error("Erro ao buscar dados do relatório.");
    } finally {
      setLoading(false);
    }
  }, [currentClinic, startDate, endDate, professionalId, selectedStatuses, startTime, endTime, patientSearch]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(appointments.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(
    () => appointments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [appointments, page]
  );

  // Summary
  const summary = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byProfessional: Record<string, number> = {};
    appointments.forEach((a) => {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      byProfessional[a.professional_name] = (byProfessional[a.professional_name] || 0) + 1;
    });
    return { byStatus, byProfessional, total: appointments.length };
  }, [appointments]);

  // PDF Export
  const exportPDF = useCallback(() => {
    if (!resolvedClinic || appointments.length === 0) return;

    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();

    // Header
    doc.setFontSize(16);
    doc.setTextColor(0, 100, 150);
    doc.text("Relatório de Agendamentos", pageWidth / 2, 16, { align: "center" });

    doc.setFontSize(11);
    doc.setTextColor(60);
    doc.text(resolvedClinic.name, pageWidth / 2, 23, { align: "center" });

    const startF = format(parseISO(startDate), "dd/MM/yyyy");
    const endF = format(parseISO(endDate), "dd/MM/yyyy");
    doc.text(`Período: ${startF} a ${endF}`, pageWidth / 2, 29, { align: "center" });

    // Filters info
    const filterParts: string[] = [];
    if (professionalId !== "all") {
      const p = professionals.find((pr) => pr.id === professionalId);
      if (p) filterParts.push(`Profissional: ${p.name}`);
    }
    if (selectedStatuses.length > 0 && selectedStatuses.length < STATUS_OPTIONS.length) {
      filterParts.push(`Status: ${selectedStatuses.map((s) => STATUS_LABELS[s] || s).join(", ")}`);
    }
    if (startTime || endTime) {
      filterParts.push(`Horário: ${startTime || "00:00"} - ${endTime || "23:59"}`);
    }
    if (patientSearch.trim()) {
      filterParts.push(`Paciente: ${patientSearch.trim()}`);
    }

    let startY = 34;
    if (filterParts.length > 0) {
      doc.setFontSize(8);
      doc.text(`Filtros: ${filterParts.join(" | ")}`, pageWidth / 2, startY, { align: "center" });
      startY += 6;
    }

    // Table
    const tableData = appointments.map((a) => [
      format(parseISO(a.appointment_date), "dd/MM/yyyy"),
      a.start_time?.slice(0, 5) || "—",
      a.end_time?.slice(0, 5) || "—",
      a.patient_name,
      a.patient_phone || "—",
      a.professional_name,
      STATUS_LABELS[a.status] || a.status,
      TYPE_LABELS[a.type] || a.type || "—",
      a.procedure_name || "—",
    ]);

    autoTable(doc, {
      startY,
      head: [["Data", "Início", "Fim", "Paciente", "Telefone", "Profissional", "Status", "Tipo", "Procedimento"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [0, 100, 150], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      styles: { cellPadding: 2 },
    });

    // Summary section
    let y = (doc as any).lastAutoTable.finalY + 10;
    if (y > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Resumo", 14, y);
    y += 6;

    const summaryRows: string[][] = [
      ["Total de Agendamentos", summary.total.toString()],
    ];

    Object.entries(summary.byStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) =>
        summaryRows.push([`  ${STATUS_LABELS[status] || status}`, count.toString()])
      );

    Object.entries(summary.byProfessional)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) =>
        summaryRows.push([`  Prof.: ${name}`, count.toString()])
      );

    autoTable(doc, {
      startY: y,
      body: summaryRows,
      theme: "plain",
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold" } },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    const userName = session?.user?.email || "—";
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      const footerY = doc.internal.pageSize.getHeight() - 8;
      doc.text(
        `Gerado em ${format(now, "dd/MM/yyyy 'às' HH:mm")} por ${userName} • Página ${i}/${pageCount}`,
        pageWidth / 2,
        footerY,
        { align: "center" }
      );
    }

    doc.save(`relatorio-agendamentos-${startDate}-a-${endDate}.pdf`);
    toast.success("PDF gerado com sucesso!");
  }, [appointments, currentClinic, startDate, endDate, professionalId, selectedStatuses, startTime, endTime, patientSearch, professionals, summary, session]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Relatório de Agendamentos
          </h1>
          <p className="text-muted-foreground text-sm">
            Visualize e exporte relatórios detalhados de agendamentos
          </p>
        </div>
        {appointments.length > 0 && (
          <Button onClick={exportPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            Exportar PDF
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Date range + Professional + Patient search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Data Inicial</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data Final</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Profissional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar Paciente</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do paciente..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Time filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Horário Início (a partir de)
              </Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Horário Fim (até)
              </Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Row 3: Status checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Status</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllStatuses}
                className="text-xs h-6 px-2"
              >
                {selectedStatuses.length === STATUS_OPTIONS.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {STATUS_OPTIONS.map((status) => (
                <label
                  key={status.value}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <Checkbox
                    checked={selectedStatuses.includes(status.value)}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  <Badge variant="outline" className={`${status.color} border-0 text-xs font-medium`}>
                    {status.label}
                  </Badge>
                </label>
              ))}
            </div>
            {selectedStatuses.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum status selecionado = todos os status serão incluídos
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={fetchReport} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {!loading && hasSearched && appointments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          {STATUS_OPTIONS.map((status) => {
            const count = summary.byStatus[status.value] || 0;
            if (count === 0) return null;
            return (
              <Card key={status.value}>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{status.label}</p>
                  <p className="text-xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty State */}
      {!loading && hasSearched && appointments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum agendamento encontrado para os filtros selecionados.
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {!loading && appointments.length > 0 && (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                     <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Procedimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(a.appointment_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {a.start_time?.slice(0, 5)} - {a.end_time?.slice(0, 5)}
                        </TableCell>
                        <TableCell className="font-medium">{a.patient_name}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{a.patient_phone || "—"}</TableCell>
                        <TableCell>{a.professional_name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${STATUS_COLORS[a.status] || ""} border-0 text-xs`}
                          >
                            {STATUS_LABELS[a.status] || a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {TYPE_LABELS[a.type] || a.type || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{a.procedure_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(page * ITEMS_PER_PAGE, appointments.length)} de {appointments.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
