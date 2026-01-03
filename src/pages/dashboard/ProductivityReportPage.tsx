import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, TrendingUp, Users, Calendar, DollarSign, Clock, FileDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface ProfessionalStats {
  id: string;
  name: string;
  specialty: string;
  totalAppointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  revenue: number;
  avgDuration: number;
  completionRate: number;
}

export default function ProductivityReportPage() {
  const { currentClinic } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("current");
  const [stats, setStats] = useState<ProfessionalStats[]>([]);

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

      // Load professionals
      const { data: professionals } = await supabase
        .from("professionals")
        .select("id, name, specialty")
        .eq("clinic_id", currentClinic?.id)
        .eq("is_active", true);

      if (!professionals) {
        setStats([]);
        return;
      }

      // Load appointments for the period
      const { data: appointments } = await supabase
        .from("appointments")
        .select(`
          id,
          professional_id,
          status,
          duration_minutes,
          procedure_id,
          procedures:procedure_id (price)
        `)
        .eq("clinic_id", currentClinic?.id)
        .gte("appointment_date", format(start, "yyyy-MM-dd"))
        .lte("appointment_date", format(end, "yyyy-MM-dd"));

      // Calculate stats per professional
      const professionalStats: ProfessionalStats[] = professionals.map((prof) => {
        const profAppointments = (appointments || []).filter(a => a.professional_id === prof.id);
        const completed = profAppointments.filter(a => a.status === "completed");
        const cancelled = profAppointments.filter(a => a.status === "cancelled");
        const noShow = profAppointments.filter(a => a.status === "no_show");

        const revenue = completed.reduce((sum, a) => {
          const price = (a.procedures as any)?.price || 0;
          return sum + price;
        }, 0);

        const totalDuration = completed.reduce((sum, a) => sum + (a.duration_minutes || 30), 0);
        const avgDuration = completed.length > 0 ? totalDuration / completed.length : 0;

        return {
          id: prof.id,
          name: prof.name,
          specialty: prof.specialty || "Geral",
          totalAppointments: profAppointments.length,
          completed: completed.length,
          cancelled: cancelled.length,
          noShow: noShow.length,
          revenue,
          avgDuration: Math.round(avgDuration),
          completionRate: profAppointments.length > 0 
            ? Math.round((completed.length / profAppointments.length) * 100) 
            : 0,
        };
      });

      // Sort by completed appointments
      professionalStats.sort((a, b) => b.completed - a.completed);
      setStats(professionalStats);
    } catch (error) {
      console.error("Error loading productivity data:", error);
      toast.error("Erro ao carregar dados de produtividade");
    } finally {
      setLoading(false);
    }
  };

  const totals = {
    appointments: stats.reduce((sum, s) => sum + s.totalAppointments, 0),
    completed: stats.reduce((sum, s) => sum + s.completed, 0),
    cancelled: stats.reduce((sum, s) => sum + s.cancelled, 0),
    noShow: stats.reduce((sum, s) => sum + s.noShow, 0),
    revenue: stats.reduce((sum, s) => sum + s.revenue, 0),
  };

  const chartData = stats.slice(0, 10).map(s => ({
    name: s.name.split(" ")[0],
    atendimentos: s.completed,
    cancelados: s.cancelled,
    faltas: s.noShow,
  }));

  const pieData = [
    { name: "Concluídos", value: totals.completed, color: "#22c55e" },
    { name: "Cancelados", value: totals.cancelled, color: "#f59e0b" },
    { name: "Faltas", value: totals.noShow, color: "#ef4444" },
  ];

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
            <h1 className="text-2xl font-bold">Produtividade por Profissional</h1>
            <p className="text-muted-foreground">
              Análise de desempenho e métricas de atendimento
            </p>
          </div>
          <div className="flex items-center gap-4">
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Profissionais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.appointments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Concluídos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totals.completed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Faltas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totals.noShow}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Receita
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {totals.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Atendimentos por Profissional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="atendimentos" name="Concluídos" fill="#22c55e" />
                    <Bar dataKey="cancelados" name="Cancelados" fill="#f59e0b" />
                    <Bar dataKey="faltas" name="Faltas" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Profissional</CardTitle>
            <CardDescription>
              Métricas detalhadas de cada profissional no período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Concluídos</TableHead>
                  <TableHead className="text-center">Cancelados</TableHead>
                  <TableHead className="text-center">Faltas</TableHead>
                  <TableHead className="text-center">Taxa</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((prof) => (
                  <TableRow key={prof.id}>
                    <TableCell className="font-medium">{prof.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{prof.specialty}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{prof.totalAppointments}</TableCell>
                    <TableCell className="text-center text-green-600 font-medium">
                      {prof.completed}
                    </TableCell>
                    <TableCell className="text-center text-yellow-600">
                      {prof.cancelled}
                    </TableCell>
                    <TableCell className="text-center text-red-600">
                      {prof.noShow}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={prof.completionRate >= 80 ? "default" : prof.completionRate >= 60 ? "secondary" : "destructive"}
                      >
                        {prof.completionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {prof.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                  </TableRow>
                ))}
                {stats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum dado disponível para o período selecionado
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
