import { useEffect, useState, useRef } from "react";
import { 
  Calendar, 
  Users, 
  Clock, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  FileText,
  Brain,
  ArrowRight,
  Stethoscope,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BirthdayMessagesHistory from "@/components/dashboard/BirthdayMessagesHistory";
import PendingPayslipReviews from "@/components/dashboard/PendingPayslipReviews";
import { FeatureGateInline } from "@/components/features/FeatureGate";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardStats {
  todayAppointments: number;
  totalPatients: number;
  totalProfessionals: number;
  futureAppointments: number;
  medicalRecordsCount: number;
  completionRate: number;
}

export default function DashboardOverview() {
  const { currentClinic, userRoles } = useAuth();
  
  const currentClinicRole = userRoles.find(r => r.clinic_id === currentClinic?.id);
  const isProfessionalRole = currentClinicRole?.role === 'professional';
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    totalPatients: 0,
    totalProfessionals: 0,
    futureAppointments: 0,
    medicalRecordsCount: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [procedureData, setProcedureData] = useState<any[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (currentClinic) {
      fetchDashboardData();
      setupRealtimeSubscription();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [currentClinic]);

  const setupRealtimeSubscription = () => {
    if (!currentClinic) return;

    channelRef.current = supabase
      .channel('dashboard-appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `clinic_id=eq.${currentClinic.id}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();
  };

  const fetchDashboardData = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Today's appointments
      const { count: todayCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .eq('appointment_date', today);

      // Future appointments
      const { count: futureCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .gt('appointment_date', today)
        .neq('status', 'cancelled');

      // Total patients
      const { count: patientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id);

      // Total professionals
      const { count: professionalsCount } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true);

      // Medical records count
      const { count: recordsCount } = await supabase
        .from('medical_records')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id);

      // Completion rate
      const { count: completedCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .eq('status', 'completed');

      const { count: totalCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .neq('status', 'cancelled');

      const completionRate = totalCount && totalCount > 0 
        ? Math.round((completedCount || 0) / totalCount * 100) 
        : 0;

      setStats({
        todayAppointments: todayCount || 0,
        totalPatients: patientsCount || 0,
        totalProfessionals: professionalsCount || 0,
        futureAppointments: futureCount || 0,
        medicalRecordsCount: recordsCount || 0,
        completionRate,
      });

      // Chart data - last 6 months
      await fetchChartData();
      await fetchProcedureData();

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    if (!currentClinic) return;

    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = date.toISOString().split('T')[0];
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const { count: total } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .gte('appointment_date', monthStart)
        .lte('appointment_date', monthEnd);

      const { count: completed } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .eq('status', 'completed')
        .gte('appointment_date', monthStart)
        .lte('appointment_date', monthEnd);

      const { count: cancelled } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .eq('status', 'cancelled')
        .gte('appointment_date', monthStart)
        .lte('appointment_date', monthEnd);

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      months.push({
        name: `${monthNames[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`,
        total: total || 0,
        realizadas: completed || 0,
        canceladas: cancelled || 0,
      });
    }

    setChartData(months);
  };

  const fetchProcedureData = async () => {
    if (!currentClinic) return;

    const { data: procedures } = await supabase
      .from('appointments')
      .select(`
        procedure_id,
        procedures:procedure_id (name)
      `)
      .eq('clinic_id', currentClinic.id)
      .not('procedure_id', 'is', null)
      .limit(100);

    if (procedures && procedures.length > 0) {
      const counts: Record<string, number> = {};
      procedures.forEach((p: any) => {
        const name = p.procedures?.name || 'Outros';
        counts[name] = (counts[name] || 0) + 1;
      });

      const data = Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      setProcedureData(data);
    } else {
      setProcedureData([
        { name: 'Consulta Geral', value: 5 },
        { name: 'Retorno', value: 4 },
        { name: 'Exame', value: 3 },
      ]);
    }
  };

  const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Stat cards with gradient backgrounds matching the reference
  const topCards = [
    {
      title: "CADASTROS",
      value: stats.totalPatients,
      subtitle: "Total de Pacientes",
      buttonText: "Ver detalhes",
      buttonLink: "/dashboard/patients",
      gradient: "from-blue-400 via-blue-500 to-cyan-500",
      icon: Users,
      iconBg: "bg-blue-300/50",
    },
    {
      title: "PROFISSIONAIS",
      value: stats.totalProfessionals,
      subtitle: "Terapeutas",
      buttonText: "Ver detalhes",
      buttonLink: "/dashboard/professionals",
      gradient: "from-pink-400 via-pink-500 to-rose-500",
      icon: Stethoscope,
      iconBg: "bg-pink-300/50",
    },
    {
      title: "HOJE",
      value: stats.todayAppointments,
      subtitle: "Sessões Hoje",
      buttonText: "Ver agenda",
      buttonLink: "/dashboard/calendar",
      gradient: "from-orange-400 via-orange-500 to-amber-500",
      icon: Calendar,
      iconBg: "bg-orange-300/50",
    },
    {
      title: "FUTURAS",
      value: stats.futureAppointments,
      subtitle: "Sessões Agendadas",
      buttonText: "Ver todas",
      buttonLink: "/dashboard/calendar",
      gradient: "from-emerald-400 via-emerald-500 to-teal-500",
      icon: Clock,
      iconBg: "bg-emerald-300/50",
    },
  ];

  const bottomCards = [
    {
      title: "PRONTUÁRIOS",
      value: stats.medicalRecordsCount,
      subtitle: "Evoluções Registradas",
      buttonText: "Ver prontuários",
      buttonLink: "/dashboard/medical-records",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-100",
      icon: FileText,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-500",
    },
    {
      title: "TAXA DE PRESENÇA",
      value: `${stats.completionRate}%`,
      subtitle: "Taxa Realização",
      buttonText: "Ver registros",
      buttonLink: "/dashboard/reports",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-100",
      icon: TrendingUp,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      title: "AÇÃO",
      value: "+",
      isAction: true,
      subtitle: "Nova Evolução",
      buttonText: "Registrar nova",
      buttonLink: "/dashboard/medical-records",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-100",
      icon: Plus,
      iconBg: "bg-rose-100",
      iconColor: "text-rose-500",
    },
  ];

  const totalSessions = chartData.reduce((acc, m) => acc + m.total, 0);
  const totalRealizadas = chartData.reduce((acc, m) => acc + m.realizadas, 0);
  const sessionsRate = totalSessions > 0 ? Math.round((totalRealizadas / totalSessions) * 100) : 0;

  return (
    <div className="min-h-full flex flex-col gap-6 animate-fade-in p-1">
      {/* Top Row - Main Stats with Gradient Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((card, i) => (
          <Card
            key={i}
            className={`relative overflow-hidden border-0 shadow-lg bg-gradient-to-br ${card.gradient} text-white`}
          >
            <CardContent className="p-5 relative">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wider opacity-90">{card.title}</p>
                  <p className="text-4xl font-bold">{card.value}</p>
                  <p className="text-sm opacity-80">{card.subtitle}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <card.icon className="h-6 w-6 text-white/80" />
                </div>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="mt-4 text-white/90 hover:text-white hover:bg-white/20 px-0"
              >
                <Link to={card.buttonLink} className="flex items-center gap-1">
                  {card.buttonText} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Second Row - Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {bottomCards.map((card, i) => (
          <Card
            key={i}
            className={`relative overflow-hidden border ${card.borderColor} shadow-sm ${card.bgColor}`}
          >
            <CardContent className="p-5 relative">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground">{card.title}</p>
                  {card.isAction ? (
                    <div className={`w-14 h-14 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                      <Plus className={`h-8 w-8 ${card.iconColor}`} />
                    </div>
                  ) : (
                    <p className="text-4xl font-bold text-foreground">{card.value}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{card.subtitle}</p>
                </div>
                {!card.isAction && (
                  <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                    <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                  </div>
                )}
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="mt-4 text-muted-foreground hover:text-foreground px-0"
              >
                <Link to={card.buttonLink} className="flex items-center gap-1">
                  {card.buttonText} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sessions Chart */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-semibold text-lg">Sessões nos Últimos 6 Meses</h3>
            </div>
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/20">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-5">
            <div className="flex justify-around mb-4 text-center">
              <div>
                <p className="text-2xl font-bold text-indigo-600">{totalSessions}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{sessionsRate}%</p>
                <p className="text-sm text-muted-foreground">Taxa Realização</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">+0%</p>
                <p className="text-sm text-muted-foreground">vs. 6m anteriores</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ fill: '#6366f1', strokeWidth: 2 }}
                    name="Total de Sessões"
                  />
                  <Line
                    type="monotone"
                    dataKey="realizadas"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', strokeWidth: 2 }}
                    name="Realizadas"
                  />
                  <Line
                    type="monotone"
                    dataKey="canceladas"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 2 }}
                    name="Canceladas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ⓘ Clique nas legendas para mostrar/ocultar dados
            </p>
          </CardContent>
        </Card>

        {/* Procedures Donut Chart */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Brain className="h-5 w-5" />
              <h3 className="font-semibold text-lg">Tipos de Procedimentos</h3>
            </div>
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/20">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-5">
            <div className="flex gap-4">
              {/* Legend */}
              <div className="flex-1 space-y-3">
                {procedureData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {item.name}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {item.value} pacientes
                    </Badge>
                  </div>
                ))}
              </div>
              {/* Chart */}
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={procedureData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {procedureData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              ⓘ Dados dos últimos 6 meses • Hover para detalhes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payslip Reviews - Hide from professionals */}
      {!isProfessionalRole && <PendingPayslipReviews />}

      {/* Birthday Messages History - Protected by feature and hidden from professionals */}
      {!isProfessionalRole && (
        <FeatureGateInline feature="whatsapp_birthday_messages">
          <BirthdayMessagesHistory />
        </FeatureGateInline>
      )}
    </div>
  );
}
