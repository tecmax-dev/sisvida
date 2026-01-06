import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, UserX, TrendingDown, Calendar, AlertTriangle, Unlock } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface NoShowStats {
  total: number;
  noShows: number;
  rate: number;
  blockedPatients: number;
}

interface NoShowPatient {
  id: string;
  name: string;
  phone: string;
  noShowCount: number;
  lastNoShow: string;
  isBlocked: boolean;
  blockedUntil: string | null;
  professionalName: string;
}

export default function NoShowReportPage() {
  const { currentClinic } = useAuth();
  const { isAdmin } = usePermissions();
  // Apenas admins podem desbloquear pacientes (owner, admin ou super admin)
  const canUnblockPatients = isAdmin;
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("current");
  const [stats, setStats] = useState<NoShowStats>({ total: 0, noShows: 0, rate: 0, blockedPatients: 0 });
  const [patients, setPatients] = useState<NoShowPatient[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic?.id, period]);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "current":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "last3":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "last6":
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // Load appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select(`
          id,
          status,
          appointment_date,
          patient_id,
          professional_id,
          patients:patient_id (id, name, phone, no_show_blocked_until),
          professionals:professional_id (name)
        `)
        .eq("clinic_id", currentClinic?.id)
        .gte("appointment_date", format(start, "yyyy-MM-dd"))
        .lte("appointment_date", format(end, "yyyy-MM-dd"));

      const noShowAppointments = (appointments || []).filter(a => a.status === "no_show");
      
      // Calculate stats
      const totalAppointments = (appointments || []).length;
      const noShowCount = noShowAppointments.length;
      const rate = totalAppointments > 0 ? (noShowCount / totalAppointments) * 100 : 0;

      // Count blocked patients
      const { count: blockedCount } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", currentClinic?.id)
        .not("no_show_blocked_until", "is", null)
        .gte("no_show_blocked_until", new Date().toISOString());

      setStats({
        total: totalAppointments,
        noShows: noShowCount,
        rate: Math.round(rate * 10) / 10,
        blockedPatients: blockedCount || 0,
      });

      // Group no-shows by patient
      const patientMap = new Map<string, NoShowPatient>();
      noShowAppointments.forEach((a) => {
        const patient = a.patients as any;
        if (!patient) return;

        const existing = patientMap.get(patient.id);
        if (existing) {
          existing.noShowCount++;
          if (a.appointment_date > existing.lastNoShow) {
            existing.lastNoShow = a.appointment_date;
            existing.professionalName = (a.professionals as any)?.name || "-";
          }
        } else {
          patientMap.set(patient.id, {
            id: patient.id,
            name: patient.name,
            phone: patient.phone || "-",
            noShowCount: 1,
            lastNoShow: a.appointment_date,
            isBlocked: patient.no_show_blocked_until && new Date(patient.no_show_blocked_until) > new Date(),
            blockedUntil: patient.no_show_blocked_until,
            professionalName: (a.professionals as any)?.name || "-",
          });
        }
      });

      const patientList = Array.from(patientMap.values());
      patientList.sort((a, b) => b.noShowCount - a.noShowCount);
      setPatients(patientList);

      // Prepare chart data - group by week/month
      const chartMap = new Map<string, number>();
      noShowAppointments.forEach((a) => {
        const date = format(parseISO(a.appointment_date), "dd/MM");
        chartMap.set(date, (chartMap.get(date) || 0) + 1);
      });

      const chartArray = Array.from(chartMap.entries())
        .map(([date, count]) => ({ date, faltas: count }))
        .slice(-14);
      setChartData(chartArray);
    } catch (error) {
      console.error("Error loading no-show data:", error);
      toast.error("Erro ao carregar dados de faltas");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (patientId: string) => {
    setUnlocking(patientId);
    try {
      const { error } = await supabase
        .from("patients")
        .update({
          no_show_blocked_until: null,
          no_show_unblocked_at: new Date().toISOString(),
          no_show_unblocked_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", patientId);

      if (error) throw error;

      toast.success("Paciente desbloqueado");
      loadData();
    } catch (error) {
      console.error("Error unblocking patient:", error);
      toast.error("Erro ao desbloquear paciente");
    } finally {
      setUnlocking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <RoleGuard permission="view_reports">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatório de Faltas (No-Show)</h1>
            <p className="text-muted-foreground">
              Análise de não comparecimentos e pacientes bloqueados
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Mês Atual</SelectItem>
              <SelectItem value="last">Mês Anterior</SelectItem>
              <SelectItem value="last3">Últimos 3 Meses</SelectItem>
              <SelectItem value="last6">Últimos 6 Meses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Total Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Faltas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.noShows}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Taxa de No-Show
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.rate > 10 ? "text-red-600" : stats.rate > 5 ? "text-yellow-600" : "text-green-600"}`}>
                {stats.rate}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Bloqueados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.blockedPatients}</div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Faltas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="faltas" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: "#ef4444" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Patients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Associados com Faltas</CardTitle>
            <CardDescription>
              Lista de associados que não compareceram aos agendamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Associado</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead className="text-center">Faltas</TableHead>
                  <TableHead>Última Falta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell>{patient.professionalName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{patient.noShowCount}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(patient.lastNoShow), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {patient.isBlocked ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Bloqueado até {format(parseISO(patient.blockedUntil!), "dd/MM/yyyy")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Liberado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {patient.isBlocked && canUnblockPatients && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUnblock(patient.id)}
                          disabled={unlocking === patient.id}
                        >
                          {unlocking === patient.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Unlock className="h-4 w-4 mr-1" />
                              Desbloquear
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {patients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma falta registrada no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
