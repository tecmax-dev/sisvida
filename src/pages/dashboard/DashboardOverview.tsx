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
  const [clinicSpecialtyCategory, setClinicSpecialtyCategory] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Determine label based on specialty category
  const getSessionLabel = () => {
    if (clinicSpecialtyCategory === 'medical') return 'Consultas';
    if (clinicSpecialtyCategory === 'dental') return 'Atendimentos';
    return 'Sessões'; // therapy, aesthetic, massage, etc.
  };

  const getProfessionalLabel = () => {
    if (clinicSpecialtyCategory === 'medical') return 'Médicos';
    if (clinicSpecialtyCategory === 'dental') return 'Dentistas';
    if (clinicSpecialtyCategory === 'therapy') return 'Terapeutas';
    if (clinicSpecialtyCategory === 'aesthetic') return 'Esteticistas';
    if (clinicSpecialtyCategory === 'massage') return 'Massoterapeutas';
    return 'Profissionais';
  };

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
      
      // Fetch clinic's main specialty category
      const { data: professionalsData } = await supabase
        .from('professionals')
        .select(`
          professional_specialties (
            specialty:specialty_id (category)
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .limit(1);
      
      if (professionalsData && professionalsData.length > 0) {
        const specialties = professionalsData[0]?.professional_specialties as any[];
        if (specialties && specialties.length > 0) {
          setClinicSpecialtyCategory(specialties[0]?.specialty?.category || null);
        }
      }
      
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

    // Calculate date 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const { data: procedures } = await supabase
      .from('appointments')
      .select(`
        procedure_id,
        procedures:procedure_id (name, color)
      `)
      .eq('clinic_id', currentClinic.id)
      .not('procedure_id', 'is', null)
      .gte('appointment_date', sixMonthsAgoStr);

    if (procedures && procedures.length > 0) {
      const counts: Record<string, { count: number; color: string | null }> = {};
      procedures.forEach((p: any) => {
        const name = p.procedures?.name || 'Outros';
        const color = p.procedures?.color || null;
        if (!counts[name]) {
          counts[name] = { count: 0, color };
        }
        counts[name].count += 1;
      });

      const data = Object.entries(counts)
        .map(([name, { count, color }]) => ({ name, value: count, color }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      setProcedureData(data);
    } else {
      setProcedureData([]);
    }
  };

  const CARD_TONES = ['bg-primary/10 text-primary', 'bg-destructive/10 text-destructive', 'bg-success/10 text-success', 'bg-info/10 text-info'];
  const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
  
  const getProcedureColor = (item: any, index: number) => {
    return item.color || CHART_COLORS[index % CHART_COLORS.length];
  };

  // Stat cards with gradient backgrounds matching the reference
  const topCards = [
    {
      title: "CADASTROS",
      value: stats.totalPatients,
      subtitle: "Total de Pacientes",
      buttonText: "Ver detalhes",
      buttonLink: "/dashboard/patients",
      bgSolid: "bg-primary",
      icon: Users,
      iconBg: "bg-white/20",
    },
    {
      title: "PROFISSIONAIS",
      value: stats.totalProfessionals,
      subtitle: getProfessionalLabel(),
      buttonText: "Ver detalhes",
      buttonLink: "/dashboard/professionals",
      bgSolid: "bg-[hsl(0_85%_50%)]",
      icon: Stethoscope,
      iconBg: "bg-white/20",
    },
    {
      title: "HOJE",
      value: stats.todayAppointments,
      subtitle: `${getSessionLabel()} Hoje`,
      buttonText: "Ver agenda",
      buttonLink: "/dashboard/calendar",
      bgSolid: "bg-primary/80",
      icon: Calendar,
      iconBg: "bg-white/20",
    },
    {
      title: "FUTURAS",
      value: stats.futureAppointments,
      subtitle: `${getSessionLabel()} Agendadas`,
      buttonText: "Ver todas",
      buttonLink: "/dashboard/calendar",
      bgSolid: "bg-[hsl(220_80%_35%)]",
      icon: Clock,
      iconBg: "bg-white/20",
    },
  ];

  const bottomCards = [
    {
      title: "PRONTUÁRIOS",
      value: stats.medicalRecordsCount,
      subtitle: "Evoluções Registradas",
      buttonText: "Ver prontuários",
      buttonLink: "/dashboard/medical-records",
      bgColor: "bg-primary/5",
      borderColor: "border-primary/10",
      icon: FileText,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-primary",
    },
    {
      title: "TAXA DE PRESENÇA",
      value: `${stats.completionRate}%`,
      subtitle: "Taxa Realização",
      buttonText: "Ver registros",
      buttonLink: "/dashboard/reports",
      bgColor: "bg-warning/5",
      borderColor: "border-warning/10",
      icon: TrendingUp,
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      valueColor: "text-warning",
    },
    {
      title: "AÇÃO",
      value: "+",
      isAction: true,
      subtitle: "Nova Evolução",
      buttonText: "Registrar nova",
      buttonLink: "/dashboard/medical-records",
      bgColor: "bg-destructive/5",
      borderColor: "border-destructive/10",
      icon: Plus,
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      valueColor: "text-destructive",
    },
  ];

  const totalSessions = chartData.reduce((acc, m) => acc + m.total, 0);
  const totalRealizadas = chartData.reduce((acc, m) => acc + m.realizadas, 0);
  const sessionsRate = totalSessions > 0 ? Math.round((totalRealizadas / totalSessions) * 100) : 0;

  return (
    <div className="min-h-full flex flex-col gap-6 animate-fade-in p-1">
      {/* Cabeçalho */}
      <div className="border-b border-border/70 pb-4">
        <p className="mb-1 text-xs font-semibold uppercase text-primary">{(() => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; })()}</p>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Módulo Clínica</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumo de cadastros, agenda e atendimentos</p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {topCards.map((card, i) => (
          <Link key={i} to={card.buttonLink} className="group">
            <Card className="h-full transition-[border-color,box-shadow] group-hover:border-primary/30 group-hover:shadow-md">
              <CardContent className="flex items-start justify-between p-5">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.title}</p>
                  <p className="text-3xl font-bold text-foreground">{card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.subtitle}</p>
                  <p className="flex items-center gap-1 pt-2 text-xs font-medium text-primary">{card.buttonText} <ArrowRight className="h-3.5 w-3.5" /></p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${CARD_TONES[i % CARD_TONES.length]}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Ações e indicadores secundários */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {bottomCards.map((card, i) => (
          <Link key={i} to={card.buttonLink} className="group">
            <Card className="h-full transition-[border-color,box-shadow] group-hover:border-primary/30 group-hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                  {card.isAction ? <Plus className={`h-5 w-5 ${card.iconColor}`} /> : <card.icon className={`h-5 w-5 ${card.iconColor}`} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.title}</p>
                  {card.isAction ? (
                    <p className="text-base font-semibold text-foreground">{card.subtitle}</p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{card.value} <span className="text-sm font-normal text-muted-foreground">{card.subtitle}</span></p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sessions Chart */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-primary px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-semibold text-lg">Sessões nos Últimos 6 Meses</h3>
            </div>
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/20">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-around mb-4 text-center gap-2">
              <div>
                <p className="text-xl sm:text-2xl font-bold text-indigo-600">{totalSessions}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{sessionsRate}%</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Taxa Realização</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-2xl font-bold text-gray-600">+0%</p>
                <p className="text-sm text-muted-foreground">vs. 6m anteriores</p>
              </div>
            </div>
            <div className="h-52 sm:h-64">
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
          <div className="bg-primary px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Brain className="h-5 w-5" />
              <h3 className="font-semibold text-lg">Tipos de Procedimentos</h3>
            </div>
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/20">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-4 sm:p-5">
            {procedureData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Brain className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">Nenhum procedimento registrado</p>
                <p className="text-xs">nos últimos 6 meses</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Legend */}
                <div className="flex-1 space-y-2 sm:space-y-3 order-2 sm:order-1">
                  {procedureData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getProcedureColor(item, index) }}
                        />
                        <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[150px] sm:max-w-[200px]">
                          {item.name}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {item.value}
                      </Badge>
                    </div>
                  ))}
                </div>
                {/* Chart */}
                <div className="w-full sm:w-48 h-40 sm:h-48 order-1 sm:order-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={procedureData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {procedureData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getProcedureColor(entry, index)}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3 sm:mt-4">
              ⓘ Dados dos últimos 6 meses
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
