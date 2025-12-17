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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  scheduled: { icon: AlertCircle, color: "text-warning", label: "Aguardando" },
  confirmed: { icon: CheckCircle2, color: "text-success", label: "Confirmado" },
  completed: { icon: CheckCircle2, color: "text-info", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-destructive", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-destructive", label: "Não compareceu" },
};

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
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
            description: `${patient?.name || 'Paciente'} agendou para ${new Date(payload.new.appointment_date).toLocaleDateString('pt-BR')} às ${payload.new.start_time.slice(0, 5)}`,
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
          pendingConfirmations: appointments.filter(a => a.status === 'scheduled').length,
        }));
      }

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
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Pacientes Cadastrados",
      value: stats.totalPatients.toString(),
      icon: Users,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Taxa de Presença",
      value: `${stats.completionRate}%`,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Aguardando Confirmação",
      value: stats.pendingConfirmations.toString(),
      icon: Bell,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground">
            Olá, {profile?.name || "Usuário"}! Aqui está o resumo da sua clínica.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchDashboardData} title="Atualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="hero" asChild>
            <Link to="/dashboard/calendar">
              <Calendar className="h-4 w-4 mr-2" />
              Nova Consulta
            </Link>
          </Button>
        </div>
      </div>

      {/* Realtime indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
        </span>
        Atualizações em tempo real ativas
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Consultas de Hoje</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/calendar">Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : todayAppointments.length > 0 ? (
            <div className="space-y-3">
              {todayAppointments.map((appointment) => {
                const status = statusConfig[appointment.status as keyof typeof statusConfig] || statusConfig.scheduled;
                const StatusIcon = status.icon;
                const timeStr = appointment.start_time.slice(0, 5);
                const isNew = newAppointments.includes(appointment.id);
                
                return (
                  <div
                    key={appointment.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${
                      isNew 
                        ? "border-success bg-success/5 animate-pulse" 
                        : "border-border hover:bg-muted/50"
                    } ${
                      appointment.status === "cancelled" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="w-16 text-center">
                      <span className="text-sm font-semibold text-foreground">
                        {timeStr}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {appointment.patient?.name || "Paciente"}
                        </p>
                        {isNew && (
                          <Badge variant="secondary" className="text-xs bg-success/20 text-success">
                            Novo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {typeLabels[appointment.type] || appointment.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      <span className={`text-sm ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="mb-4">Nenhuma consulta agendada para hoje</p>
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
