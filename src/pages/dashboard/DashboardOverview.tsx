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
  Bell,
  RefreshCw,
  UserPlus,
  FileText,
  BarChart3,
  Sunrise,
  Sun,
  Moon,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardStats {
  todayAppointments: number;
  totalPatients: number;
  completionRate: number;
  pendingConfirmations: number;
}

interface Appointment {
  id: string;
  start_time: string;
  type: string;
  status: string;
  patient: {
    name: string;
  };
}

const statusConfig = {
  scheduled: { icon: AlertCircle, color: "text-warning", bgColor: "bg-warning/10", label: "Aguardando" },
  confirmed: { icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10", label: "Confirmado" },
  completed: { icon: CheckCircle2, color: "text-info", bgColor: "bg-info/10", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Não compareceu" },
  in_progress: { icon: Clock, color: "text-primary", bgColor: "bg-primary/10", label: "Em andamento" },
  arrived: { icon: CheckCircle2, color: "text-info", bgColor: "bg-info/10", label: "Chegou" },
};

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Bom dia", icon: Sunrise };
  if (hour < 18) return { text: "Boa tarde", icon: Sun };
  return { text: "Boa noite", icon: Moon };
};

export default function DashboardOverview() {
  const { currentClinic, profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    totalPatients: 0,
    completionRate: 0,
    pendingConfirmations: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAppointments, setNewAppointments] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `clinic_id=eq.${currentClinic.id}`,
        },
        async (payload) => {
          console.log('New appointment:', payload);
          
          // Fetch patient name for the new appointment
          const { data: patient } = await supabase
            .from('patients')
            .select('name')
            .eq('id', payload.new.patient_id)
            .single();

          toast({
            title: "Novo agendamento!",
            description: `${patient?.name || 'Paciente'} agendou para ${new Date(payload.new.appointment_date + "T12:00:00").toLocaleDateString('pt-BR')} às ${payload.new.start_time.slice(0, 5)}`,
          });

          // Highlight new appointment
          setNewAppointments(prev => [...prev, payload.new.id]);
          setTimeout(() => {
            setNewAppointments(prev => prev.filter(id => id !== payload.new.id));
          }, 5000);

          // Refresh data
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `clinic_id=eq.${currentClinic.id}`,
        },
        (payload) => {
          console.log('Updated appointment:', payload);
          
          // Check if status changed to confirmed
          if (payload.old.status !== 'confirmed' && payload.new.status === 'confirmed') {
            toast({
              title: "Consulta confirmada!",
              description: "Uma consulta foi confirmada pelo paciente.",
            });
          }
          
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
      
      // Fetch today's appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          type,
          status,
          patient:patients (
            name
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('appointment_date', today)
        .order('start_time');

      if (appointments) {
        setTodayAppointments(appointments as unknown as Appointment[]);
        setStats(prev => ({ 
          ...prev, 
          todayAppointments: appointments.length,
        }));
      }

      // Fetch ALL pending confirmations (not just today)
      const { count: pendingCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .eq('status', 'scheduled')
        .gte('appointment_date', today);

      setStats(prev => ({ 
        ...prev, 
        pendingConfirmations: pendingCount || 0,
      }));

      // Fetch total patients
      const { count: patientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id);

      if (patientsCount !== null) {
        setStats(prev => ({ ...prev, totalPatients: patientsCount }));
      }

      // Calculate completion rate (completed / total non-cancelled)
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

      if (completedCount !== null && totalCount !== null && totalCount > 0) {
        setStats(prev => ({ 
          ...prev, 
          completionRate: Math.round((completedCount / totalCount) * 100) 
        }));
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Consultas Hoje",
      value: stats.todayAppointments.toString(),
      icon: Calendar,
      gradient: "from-primary/10 via-primary/5 to-transparent",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
    },
    {
      title: "Pacientes Cadastrados",
      value: stats.totalPatients.toString(),
      icon: Users,
      gradient: "from-info/10 via-info/5 to-transparent",
      iconBg: "bg-info/15",
      iconColor: "text-info",
    },
    {
      title: "Taxa de Presença",
      value: `${stats.completionRate}%`,
      icon: TrendingUp,
      gradient: "from-success/10 via-success/5 to-transparent",
      iconBg: "bg-success/15",
      iconColor: "text-success",
    },
    {
      title: "Aguardando Confirmação",
      value: stats.pendingConfirmations.toString(),
      icon: Bell,
      gradient: "from-warning/10 via-warning/5 to-transparent",
      iconBg: "bg-warning/15",
      iconColor: "text-warning",
    },
  ];

  const quickActions = [
    { icon: UserPlus, label: "Novo Paciente", href: "/dashboard/patients" },
    { icon: Calendar, label: "Nova Consulta", href: "/dashboard/calendar" },
    { icon: FileText, label: "Prontuário", href: "/dashboard/medical-records" },
    { icon: BarChart3, label: "Relatórios", href: "/dashboard/reports" },
  ];

  // Group appointments by period
  const morningAppointments = todayAppointments.filter(a => {
    const hour = parseInt(a.start_time.split(':')[0]);
    return hour < 12;
  });
  const afternoonAppointments = todayAppointments.filter(a => {
    const hour = parseInt(a.start_time.split(':')[0]);
    return hour >= 12;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <GreetingIcon className="h-4 w-4" />
            <span>{greeting.text}</span>
            <span className="text-border">•</span>
            <span>{format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            Olá, {profile?.name?.split(' ')[0] || "Usuário"}! 👋
          </h1>
          <p className="text-muted-foreground">
            Aqui está o resumo da sua clínica para hoje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={fetchDashboardData} 
            title="Atualizar"
            className="h-10 w-10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="hero" asChild className="h-10">
            <Link to="/dashboard/calendar">
              <Plus className="h-4 w-4 mr-2" />
              Nova Consulta
            </Link>
          </Button>
        </div>
      </div>

      {/* Realtime indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
        </span>
        <span className="text-muted-foreground">Atualizações em tempo real ativas</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card 
            key={i} 
            className="relative overflow-hidden border border-border/60 bg-card shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 group"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-40`} />
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 bg-gradient-to-br from-foreground/[0.02] to-transparent" />
            <CardContent className="relative p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                    {stat.value}
                  </p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${stat.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Ações Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, i) => (
            <Button 
              key={i}
              variant="outline" 
              className="h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
              asChild
            >
              <Link to={action.href}>
                <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Today's Appointments */}
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/40">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">Consultas de Hoje</CardTitle>
            <p className="text-sm text-muted-foreground">
              {todayAppointments.length} {todayAppointments.length === 1 ? 'consulta agendada' : 'consultas agendadas'}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/5">
            <Link to="/dashboard/calendar" className="flex items-center gap-1">
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : todayAppointments.length > 0 ? (
            <div className="space-y-6">
              {/* Morning Appointments */}
              {morningAppointments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sunrise className="h-4 w-4" />
                    <span className="font-medium">Manhã</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-2">
                    {morningAppointments.map((appointment) => (
                      <AppointmentRow 
                        key={appointment.id} 
                        appointment={appointment} 
                        isNew={newAppointments.includes(appointment.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Afternoon Appointments */}
              {afternoonAppointments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sun className="h-4 w-4" />
                    <span className="font-medium">Tarde</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-2">
                    {afternoonAppointments.map((appointment) => (
                      <AppointmentRow 
                        key={appointment.id} 
                        appointment={appointment} 
                        isNew={newAppointments.includes(appointment.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground mb-4">Nenhuma consulta agendada para hoje</p>
              <Button variant="outline" asChild>
                <Link to="/dashboard/calendar">
                  <Plus className="h-4 w-4 mr-2" />
                  Agendar consulta
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Separate component for appointment row
function AppointmentRow({ appointment, isNew }: { appointment: Appointment; isNew: boolean }) {
  const status = statusConfig[appointment.status as keyof typeof statusConfig] || statusConfig.scheduled;
  const StatusIcon = status.icon;
  const timeStr = appointment.start_time.slice(0, 5);
  const patientName = appointment.patient?.name || "Paciente";
  const initials = patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
        isNew 
          ? "border-success bg-success/5 ring-2 ring-success/20" 
          : "border-border/50 hover:border-border hover:bg-muted/30"
      } ${
        appointment.status === "cancelled" ? "opacity-50" : ""
      }`}
    >
      {/* Time */}
      <div className="w-14 text-center shrink-0">
        <span className="text-lg font-semibold text-foreground tabular-nums">
          {timeStr}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-border" />

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-sm font-semibold text-primary">
          {initials}
        </span>
      </div>

      {/* Patient Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground truncate">
            {patientName}
          </p>
          {isNew && (
            <Badge className="text-xs bg-success/20 text-success border-0">
              Novo
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {typeLabels[appointment.type] || appointment.type}
        </p>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${status.bgColor}`}>
        <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
        <span className={`text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>
    </div>
  );
}
