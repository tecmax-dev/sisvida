import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Printer, Filter, Loader2, Users, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PrintAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  notes: string | null;
  dependent_id: string | null;
  professional: { id: string; name: string } | null;
  procedure: { id: string; name: string } | null;
  dependent: { id: string; name: string } | null;
}

interface MemberAppointmentsPrintReportProps {
  patientId: string;
  patientName: string;
}

const statusLabels: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em Atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não Compareceu",
};

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  follow_up: "Retorno",
  procedure: "Procedimento",
  emergency: "Emergência",
  telemedicine: "Telemedicina",
};

export function MemberAppointmentsPrintReport({ patientId, patientName }: MemberAppointmentsPrintReportProps) {
  const { currentClinic } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [appointments, setAppointments] = useState<PrintAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all"); // all | titular | dependentes
  const [fetched, setFetched] = useState(false);

  const fetchAllAppointments = async () => {
    if (!currentClinic?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("appointments")
        .select(`
          id, appointment_date, start_time, end_time, status, type, notes, dependent_id,
          professional:professionals(id, name),
          procedure:procedures(id, name),
          dependent:patient_dependents!appointments_dependent_id_fkey(id, name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic.id)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (dateFrom) query = query.gte("appointment_date", dateFrom);
      if (dateTo) query = query.lte("appointment_date", dateTo);

      const { data, error } = await query;
      if (error) throw error;
      setAppointments(data || []);
      setFetched(true);
    } catch (error) {
      console.error("Error fetching appointments for report:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    if (filterStatus !== "all") {
      filtered = filtered.filter(a => a.status === filterStatus);
    }
    if (filterPerson === "titular") {
      filtered = filtered.filter(a => !a.dependent_id);
    } else if (filterPerson === "dependentes") {
      filtered = filtered.filter(a => !!a.dependent_id);
    }
    return filtered;
  }, [appointments, filterStatus, filterPerson]);

  const safeDate = (value?: string | null, pattern = "dd/MM/yyyy") => {
    if (!value) return "-";
    try {
      const d = parseISO(value);
      if (isNaN(d.getTime())) return value;
      return format(d, pattern);
    } catch {
      return value;
    }
  };

  const handlePrint = () => {
    if (filteredAppointments.length === 0) return;

    const html = `
      <html>
        <head>
          <title>Agendamentos - ${patientName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 11px; padding: 15px; color: #333; }
            h1 { font-size: 16px; margin-bottom: 4px; }
            h2 { font-size: 12px; color: #666; margin-bottom: 12px; font-weight: normal; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 600; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; }
            td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
            tr:nth-child(even) { background: #fafafa; }
            .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
            .badge-scheduled { background: #dbeafe; color: #1e40af; }
            .badge-confirmed { background: #d1fae5; color: #065f46; }
            .badge-completed { background: #f3f4f6; color: #374151; }
            .badge-cancelled { background: #fecdd3; color: #991b1b; }
            .badge-no_show { background: #fecdd3; color: #991b1b; }
            .badge-in_progress { background: #fef3c7; color: #92400e; }
            .badge-dep { background: #ede9fe; color: #5b21b6; margin-left: 4px; }
            .summary { display: flex; gap: 20px; margin: 8px 0 12px; font-size: 11px; color: #666; }
            .summary span { font-weight: 600; color: #333; }
            .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #999; text-align: right; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Relatório de Agendamentos</h1>
          <h2>Titular: ${patientName}${dateFrom || dateTo ? ` | Período: ${dateFrom ? format(parseISO(dateFrom), "dd/MM/yyyy") : "..."} a ${dateTo ? format(parseISO(dateTo), "dd/MM/yyyy") : "..."}` : ""}</h2>
          <div class="summary">
            Total: <span>${filteredAppointments.length}</span> agendamentos
            &nbsp;|&nbsp; Titular: <span>${filteredAppointments.filter(a => !a.dependent_id).length}</span>
            &nbsp;|&nbsp; Dependentes: <span>${filteredAppointments.filter(a => !!a.dependent_id).length}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Paciente</th>
                <th>Profissional</th>
                <th>Procedimento</th>
                <th>Tipo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAppointments.map(apt => `
                <tr>
                  <td>${format(parseISO(apt.appointment_date), "dd/MM/yyyy")}</td>
                  <td>${apt.start_time.slice(0, 5)} - ${apt.end_time.slice(0, 5)}</td>
                  <td>
                    ${apt.dependent_id && apt.dependent ? `<span class="badge badge-dep">${apt.dependent.name}</span>` : patientName}
                  </td>
                  <td>${apt.professional?.name || "-"}</td>
                  <td>${apt.procedure?.name || "-"}</td>
                  <td>${typeLabels[apt.type] || apt.type}</td>
                  <td><span class="badge badge-${apt.status}">${statusLabels[apt.status] || apt.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">
            Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | ${currentClinic?.name || ""}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Relatório de Agendamentos para Impressão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Data Início</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data Fim</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="no_show">Não Compareceu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Paciente</Label>
            <Select value={filterPerson} onValueChange={setFilterPerson}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Titular + Dependentes</SelectItem>
                <SelectItem value="titular">Somente Titular</SelectItem>
                <SelectItem value="dependentes">Somente Dependentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={fetchAllAppointments} disabled={loading} size="sm" variant="outline" className="gap-2 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Filter className="h-3 w-3" />}
            Buscar
          </Button>
          {fetched && filteredAppointments.length > 0 && (
            <Button onClick={handlePrint} size="sm" className="gap-2 text-xs">
              <Printer className="h-3 w-3" />
              Imprimir ({filteredAppointments.length})
            </Button>
          )}
        </div>

        {/* Preview Table */}
        {fetched && (
          <div ref={printRef}>
            {filteredAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed">
                Nenhum agendamento encontrado com os filtros aplicados
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Horário</TableHead>
                      <TableHead className="text-xs">Paciente</TableHead>
                      <TableHead className="text-xs">Profissional</TableHead>
                      <TableHead className="text-xs">Procedimento</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map(apt => (
                      <TableRow key={apt.id}>
                        <TableCell className="text-xs">{format(parseISO(apt.appointment_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-xs">{apt.start_time.slice(0, 5)}</TableCell>
                        <TableCell className="text-xs">
                          {apt.dependent_id && apt.dependent ? (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-violet-500" />
                              {apt.dependent.name}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {patientName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{apt.professional?.name || "-"}</TableCell>
                        <TableCell className="text-xs">{apt.procedure?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={apt.status === "cancelled" || apt.status === "no_show" ? "destructive" : "outline"} className="text-[10px]">
                            {statusLabels[apt.status] || apt.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
