import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Users,
  XCircle,
  DollarSign,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface ReportData {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  newPatients: number;
  noShowRate: number;
  appointmentsByType: { name: string; value: number }[];
  appointmentsByStatus: { name: string; value: number }[];
  appointmentsByInsurance: { name: string; value: number; percentage: number }[];
  dailyAppointments: { date: string; total: number; completed: number; noShow: number }[];
}

export default function ReportsPage() {
  const { currentClinic } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<ReportData>({
    totalAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    newPatients: 0,
    noShowRate: 0,
    appointmentsByType: [],
    appointmentsByStatus: [],
    appointmentsByInsurance: [],
    dailyAppointments: [],
  });

  useEffect(() => {
    if (currentClinic) {
      fetchReportData();
    }
  }, [currentClinic, period]);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case "week":
        start.setDate(end.getDate() - 7);
        break;
      case "month":
        start.setMonth(end.getMonth() - 1);
        break;
      case "quarter":
        start.setMonth(end.getMonth() - 3);
        break;
      case "year":
        start.setFullYear(end.getFullYear() - 1);
        break;
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  };

  const fetchReportData = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const { startDate, endDate } = getDateRange();
      
      // Fetch appointments
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          type,
          status,
          patient:patients (
            id,
            insurance_plan_id,
            insurance_plan:insurance_plans (name)
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate);

      if (appointmentsError) throw appointmentsError;

      // Fetch new patients in period
      const { data: newPatientsData, error: patientsError } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', currentClinic.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      if (patientsError) throw patientsError;

      // Process data
      const total = appointments?.length || 0;
      const completed = appointments?.filter(a => a.status === 'completed').length || 0;
      const cancelled = appointments?.filter(a => a.status === 'cancelled').length || 0;
      const noShow = appointments?.filter(a => a.status === 'no_show').length || 0;
      const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;

      // Appointments by type
      const typeCount: Record<string, number> = {};
      const typeLabels: Record<string, string> = {
        first_visit: "Primeira Consulta",
        return: "Retorno",
        exam: "Exame",
        procedure: "Procedimento",
      };
      appointments?.forEach(a => {
        const label = typeLabels[a.type] || a.type;
        typeCount[label] = (typeCount[label] || 0) + 1;
      });
      const appointmentsByType = Object.entries(typeCount).map(([name, value]) => ({ name, value }));

      // Appointments by status
      const statusLabels: Record<string, string> = {
        scheduled: "Agendado",
        confirmed: "Confirmado",
        completed: "Concluído",
        cancelled: "Cancelado",
        no_show: "Não compareceu",
      };
      const statusCount: Record<string, number> = {};
      appointments?.forEach(a => {
        const label = statusLabels[a.status] || a.status;
        statusCount[label] = (statusCount[label] || 0) + 1;
      });
      const appointmentsByStatus = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

      // Appointments by insurance
      const insuranceCount: Record<string, number> = {};
      appointments?.forEach(a => {
        const insuranceName = (a.patient as any)?.insurance_plan?.name || "Particular";
        insuranceCount[insuranceName] = (insuranceCount[insuranceName] || 0) + 1;
      });
      const appointmentsByInsurance = Object.entries(insuranceCount)
        .map(([name, value]) => ({ 
          name, 
          value, 
          percentage: total > 0 ? Math.round((value / total) * 100) : 0 
        }))
        .sort((a, b) => b.value - a.value);

      // Daily appointments for line chart
      const dailyMap: Record<string, { total: number; completed: number; noShow: number }> = {};
      appointments?.forEach(a => {
        const date = a.appointment_date;
        if (!dailyMap[date]) {
          dailyMap[date] = { total: 0, completed: 0, noShow: 0 };
        }
        dailyMap[date].total++;
        if (a.status === 'completed') dailyMap[date].completed++;
        if (a.status === 'no_show') dailyMap[date].noShow++;
      });
      const dailyAppointments = Object.entries(dailyMap)
        .map(([date, values]) => ({
          date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          ...values,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14); // Last 14 days

      setData({
        totalAppointments: total,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
        newPatients: newPatientsData?.length || 0,
        noShowRate,
        appointmentsByType,
        appointmentsByStatus,
        appointmentsByInsurance,
        dailyAppointments,
      });
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const metrics = [
    {
      title: "Total de Consultas",
      value: data.totalAppointments.toString(),
      icon: Calendar,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Novos Pacientes",
      value: data.newPatients.toString(),
      icon: Users,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Taxa de No-show",
      value: `${data.noShowRate}%`,
      icon: XCircle,
      color: data.noShowRate > 15 ? "text-destructive" : "text-warning",
      bgColor: data.noShowRate > 15 ? "bg-destructive/10" : "bg-warning/10",
    },
    {
      title: "Concluídos",
      value: data.completedAppointments.toString(),
      icon: TrendingUp,
      color: "text-info",
      bgColor: "bg-info/10",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">
            Acompanhe as métricas da sua clínica
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mês</SelectItem>
            <SelectItem value="quarter">Último trimestre</SelectItem>
            <SelectItem value="year">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {metric.value}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${metric.bgColor} flex items-center justify-center`}>
                  <metric.icon className={`h-6 w-6 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Consultas por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyAppointments.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.dailyAppointments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    name="Total"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    name="Concluídos"
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="noShow" 
                    name="No-show"
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--destructive))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointments by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Consultas por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {data.appointmentsByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.appointmentsByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.appointmentsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.appointmentsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.appointmentsByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Insurance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atendimentos por Convênio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.appointmentsByInsurance.length > 0 ? (
                data.appointmentsByInsurance.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.value} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
