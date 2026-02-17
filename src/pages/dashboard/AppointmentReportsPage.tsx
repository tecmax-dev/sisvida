import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AppointmentRow {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  notes: string | null;
  patient_name: string;
  professional_name: string;
  professional_specialty: string;
  procedure_name: string | null;
  procedure_price: number | null;
  insurance_plan_name: string | null;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
  in_progress: "Em andamento",
  waiting: "Aguardando",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  no_show: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  waiting: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const TYPE_LABELS: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
};

const ITEMS_PER_PAGE = 20;

export default function AppointmentReportsPage() {
  return (
    <RoleGuard permission="view_reports">
      <AppointmentReportsContent />
    </RoleGuard>
  );
}

function AppointmentReportsContent() {
  const { currentClinic, session } = useAuth();
  const { toast } = useToast();

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [professionalId, setProfessionalId] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Data
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch professionals for filter dropdown
  useEffect(() => {
    if (!currentClinic) return;
    supabase
      .from("professionals")
      .select("id, name, specialty")
      .eq("clinic_id", currentClinic.id)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setProfessionals(data);
      });
  }, [currentClinic]);

  // Unique specialties from professionals
  const specialties = useMemo(() => {
    const set = new Set<string>();
    professionals.forEach((p) => {
      if (p.specialty) set.add(p.specialty);
    });
    return Array.from(set).sort();
  }, [professionals]);

  const fetchReport = useCallback(async () => {
    if (!currentClinic) return;
    if (!startDate || !endDate) {
      toast({ title: "Informe o período", description: "Data inicial e final são obrigatórias.", variant: "destructive" });
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
          patient:patients!appointments_patient_id_fkey(name, insurance_plan_id, insurance_plan:insurance_plans(name)),
          professional:professionals!appointments_professional_id_fkey(name, specialty),
          procedure:procedures!appointments_procedure_id_fkey(name, price)
        `)
        .eq("clinic_id", currentClinic.id)
        .gte("appointment_date", startDate)
        .lte("appointment_date", endDate)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (professionalId !== "all") {
        query = query.eq("professional_id", professionalId);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query.limit(5000);
      if (error) throw error;

      const rows: AppointmentRow[] = (data || [])
        .map((a: any) => ({
          id: a.id,
          appointment_date: a.appointment_date,
          start_time: a.start_time,
          end_time: a.end_time,
          status: a.status,
          type: a.type,
          notes: a.notes,
          patient_name: a.patient?.name || "—",
          professional_name: a.professional?.name || "—",
          professional_specialty: a.professional?.specialty || "—",
          procedure_name: a.procedure?.name || null,
          procedure_price: a.procedure?.price ?? null,
          insurance_plan_name: a.patient?.insurance_plan?.name || null,
        }))
        .filter((r) => {
          if (specialty !== "all" && r.professional_specialty !== specialty) return false;
          return true;
        });

      setAppointments(rows);
    } catch (err) {
      console.error("Error fetching appointment report:", err);
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentClinic, startDate, endDate, professionalId, specialty, statusFilter, toast]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(appointments.length / ITEMS_PER_PAGE));
  const paginatedData = useMemo(
    () => appointments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [appointments, page]
  );

  // Summary
  const summary = useMemo(() => {
    const byProfessional: Record<string, number> = {};
    const bySpecialty: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalValue = 0;

    appointments.forEach((a) => {
      byProfessional[a.professional_name] = (byProfessional[a.professional_name] || 0) + 1;
      bySpecialty[a.professional_specialty] = (bySpecialty[a.professional_specialty] || 0) + 1;
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (a.procedure_price) totalValue += a.procedure_price;
    });

    return { byProfessional, bySpecialty, byStatus, totalValue, total: appointments.length };
  }, [appointments]);

  // PDF Export
  const exportPDF = useCallback(() => {
    if (!currentClinic || appointments.length === 0) return;

    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(0, 128, 128);
    doc.text("Relatório de Consultas", pageWidth / 2, 16, { align: "center" });

    doc.setFontSize(11);
    doc.setTextColor(60);
    doc.text(currentClinic.name, pageWidth / 2, 23, { align: "center" });

    const startFormatted = format(parseISO(startDate), "dd/MM/yyyy");
    const endFormatted = format(parseISO(endDate), "dd/MM/yyyy");
    doc.text(`Período: ${startFormatted} a ${endFormatted}`, pageWidth / 2, 29, { align: "center" });

    // Active filters
    const filters: string[] = [];
    if (professionalId !== "all") {
      const p = professionals.find((pr) => pr.id === professionalId);
      if (p) filters.push(`Profissional: ${p.name}`);
    }
    if (specialty !== "all") filters.push(`Especialidade: ${specialty}`);
    if (statusFilter !== "all") filters.push(`Status: ${STATUS_LABELS[statusFilter] || statusFilter}`);
    if (filters.length > 0) {
      doc.setFontSize(9);
      doc.text(`Filtros: ${filters.join(" | ")}`, pageWidth / 2, 34, { align: "center" });
    }

    // Data table
    const tableData = appointments.map((a) => [
      format(parseISO(a.appointment_date), "dd/MM/yyyy"),
      a.start_time?.slice(0, 5) || "—",
      a.patient_name,
      a.professional_name,
      a.professional_specialty,
      STATUS_LABELS[a.status] || a.status,
      TYPE_LABELS[a.type] || a.type,
      a.insurance_plan_name || "Particular",
      a.procedure_price != null ? `R$ ${a.procedure_price.toFixed(2)}` : "—",
    ]);

    autoTable(doc, {
      startY: filters.length > 0 ? 40 : 36,
      head: [["Data", "Horário", "Paciente", "Profissional", "Especialidade", "Status", "Tipo", "Convênio", "Valor"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [0, 128, 128], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      styles: { cellPadding: 2 },
    });

    // Summary
    let y = (doc as any).lastAutoTable.finalY + 10;
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Resumo", 14, y);
    y += 6;

    const summaryRows: string[][] = [
      ["Total de Consultas", summary.total.toString()],
    ];

    // By professional
    Object.entries(summary.byProfessional)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => summaryRows.push([`  Profissional: ${name}`, count.toString()]));

    // By specialty
    Object.entries(summary.bySpecialty)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => summaryRows.push([`  Especialidade: ${name}`, count.toString()]));

    // By status
    Object.entries(summary.byStatus)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) =>
        summaryRows.push([`  Status: ${STATUS_LABELS[status] || status}`, count.toString()])
      );

    if (summary.totalValue > 0) {
      summaryRows.push(["Valor Total", `R$ ${summary.totalValue.toFixed(2)}`]);
    }

    autoTable(doc, {
      startY: y,
      body: summaryRows,
      theme: "plain",
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold" } },
    });

    // Footer on all pages
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

    doc.save(`relatorio-consultas-${startDate}-a-${endDate}.pdf`);
    toast({ title: "PDF gerado com sucesso!" });
  }, [appointments, currentClinic, startDate, endDate, professionalId, specialty, statusFilter, professionals, summary, session, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Relatório de Consultas
          </h1>
          <p className="text-muted-foreground text-sm">
            Visualize e exporte relatórios detalhados de consultas
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
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
              <Label className="text-xs">Especialidade</Label>
              <Select value={specialty} onValueChange={setSpecialty}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="scheduled">Agendada</SelectItem>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="completed">Realizada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="no_show">Não compareceu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={fetchReport} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && hasSearched && appointments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma consulta encontrada para os filtros selecionados.
          </CardContent>
        </Card>
      )}

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
                      <TableHead>Profissional</TableHead>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Convênio</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(a.appointment_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {a.start_time?.slice(0, 5) || "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{a.patient_name}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{a.professional_name}</TableCell>
                        <TableCell>{a.professional_specialty}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[a.status] || ""}`}>
                            {STATUS_LABELS[a.status] || a.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{TYPE_LABELS[a.type] || a.type}</TableCell>
                        <TableCell>{a.insurance_plan_name || "Particular"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {a.procedure_price != null ? `R$ ${a.procedure_price.toFixed(2)}` : "—"}
                        </TableCell>
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
              <span className="text-sm text-muted-foreground">
                {appointments.length} consulta(s) encontrada(s)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Total */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total de Consultas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{summary.total}</p>
              </CardContent>
            </Card>

            {/* By Professional */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Por Profissional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(summary.byProfessional)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name, count]) => (
                    <div key={name} className="flex justify-between text-sm">
                      <span className="truncate text-foreground">{name}</span>
                      <span className="font-medium text-muted-foreground">{count}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* By Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Por Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(summary.byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="text-foreground">{STATUS_LABELS[status] || status}</span>
                      <span className="font-medium text-muted-foreground">{count}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* Total Value */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {summary.totalValue > 0 ? "Valor Total" : "Por Especialidade"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.totalValue > 0 ? (
                  <p className="text-3xl font-bold text-foreground">
                    R$ {summary.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(summary.bySpecialty)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([name, count]) => (
                        <div key={name} className="flex justify-between text-sm">
                          <span className="truncate text-foreground">{name}</span>
                          <span className="font-medium text-muted-foreground">{count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
