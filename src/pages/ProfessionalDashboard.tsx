import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { AppointmentPanel } from "@/components/appointments/AppointmentPanel";
import { 
  Loader2, 
  LogOut, 
  Play, 
  CheckCircle2, 
  Clock, 
  User,
  Phone,
  Calendar,
  Stethoscope,
  AlertCircle,
  XCircle,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  clinic_id: string;
  clinic: {
    name: string;
    logo_url: string | null;
  };
}

interface Appointment {
  id: string;
  patient_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  procedure_id: string | null;
  procedure?: { id: string; name: string; price: number } | null;
  patient: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    birth_date: string | null;
  };
}

const statusConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  scheduled: { icon: AlertCircle, color: "text-amber-600", bgColor: "bg-amber-100", label: "A confirmar" },
  confirmed: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100", label: "Confirmado" },
  arrived: { icon: UserCheck, color: "text-green-600", bgColor: "bg-green-100", label: "Chegou" },
  in_progress: { icon: Play, color: "text-purple-600", bgColor: "bg-purple-100", label: "Em atendimento" },
  completed: { icon: CheckCircle2, color: "text-gray-500", bgColor: "bg-gray-100", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-orange-600", bgColor: "bg-orange-100", label: "Faltou" },
};

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
};

export default function ProfessionalDashboard() {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Appointment Panel state
  const [appointmentPanelOpen, setAppointmentPanelOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/profissional");
      return;
    }

    // Get professional linked to user
    const { data: prof, error: profError } = await supabase
      .from('professionals')
      .select(`
        id, 
        name, 
        specialty, 
        clinic_id,
        clinic:clinics (name, logo_url)
      `)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (profError || !prof) {
      toast({
        title: "Acesso negado",
        description: "Sua conta não está vinculada a um profissional.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      navigate("/profissional");
      return;
    }

    setProfessional({
      ...prof,
      clinic: prof.clinic as { name: string; logo_url: string | null }
    });
    
    await loadAppointments(prof.id, prof.clinic_id);
    setLoading(false);
  };

  const loadAppointments = async (professionalId: string, clinicId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        appointment_date,
        start_time,
        end_time,
        type,
        status,
        notes,
        started_at,
        completed_at,
        duration_minutes,
        procedure_id,
        procedure:procedures (id, name, price),
        patient:patients (id, name, phone, email, birth_date)
      `)
      .eq('professional_id', professionalId)
      .eq('clinic_id', clinicId)
      .eq('appointment_date', today)
      .in('status', ['scheduled', 'confirmed', 'in_progress', 'completed'])
      .order('start_time', { ascending: true });

    if (!error && data) {
      setAppointments(data.map(apt => ({
        ...apt,
        procedure_id: apt.procedure_id || null,
        procedure: apt.procedure as { id: string; name: string; price: number } | null,
        patient: apt.patient as { id: string; name: string; phone: string; email: string | null; birth_date: string | null }
      })));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/profissional");
  };

  const handleRefresh = async () => {
    if (!professional) return;
    setLoading(true);
    await loadAppointments(professional.id, professional.clinic_id);
    setLoading(false);
  };

  const openAppointmentPanel = (appointment: Appointment) => {
    // Navigate to the new appointment page
    navigate(`/profissional/atendimento/${appointment.id}`);
  };

  const handleAppointmentUpdate = async () => {
    if (!professional) return;
    await loadAppointments(professional.id, professional.clinic_id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) {
    return null;
  }

  const pendingAppointments = appointments.filter(a => ['scheduled', 'confirmed'].includes(a.status));
  const inProgressAppointment = appointments.find(a => a.status === 'in_progress');
  const completedAppointments = appointments.filter(a => a.status === 'completed');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {professional.clinic.logo_url ? (
                <img 
                  src={professional.clinic.logo_url} 
                  alt={professional.clinic.name} 
                  className="h-10 w-auto" 
                />
              ) : (
                <Logo />
              )}
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground">{professional.clinic.name}</p>
                <p className="font-medium text-foreground">{professional.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Welcome & Stats */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Olá, {professional.name.split(' ')[0]}!
              </h1>
              <p className="text-muted-foreground">
                {new Date().toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-warning">{pendingAppointments.length}</p>
                <p className="text-sm text-muted-foreground">Aguardando</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-info">{inProgressAppointment ? 1 : 0}</p>
                <p className="text-sm text-muted-foreground">Em atendimento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-success">{completedAppointments.length}</p>
                <p className="text-sm text-muted-foreground">Concluídos</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Current Appointment */}
        {inProgressAppointment && (
          <Card className="mb-6 border-info">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-info text-info-foreground">
                  <Play className="h-3 w-3 mr-1" />
                  Em atendimento
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold text-foreground">
                    {inProgressAppointment.patient.name}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {inProgressAppointment.start_time.substring(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {inProgressAppointment.patient.phone}
                    </span>
                  </div>
                  <Badge variant="outline" className="mt-2">
                    {typeLabels[inProgressAppointment.type] || inProgressAppointment.type}
                  </Badge>
                </div>
                
                <Button 
                  size="lg"
                  onClick={() => openAppointmentPanel(inProgressAppointment)}
                  className="bg-info hover:bg-info/90"
                >
                  <Stethoscope className="h-4 w-4 mr-2" />
                  Continuar Atendimento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Appointments */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximos atendimentos
          </h2>
          
          {pendingAppointments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Nenhum atendimento pendente para hoje
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingAppointments.map((appointment) => {
                const status = statusConfig[appointment.status];
                const StatusIcon = status?.icon || AlertCircle;
                
                return (
                  <Card key={appointment.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                            status?.bgColor
                          )}>
                            <User className={cn("h-6 w-6", status?.color)} />
                          </div>
                          
                          <div>
                            <p className="font-semibold text-foreground">
                              {appointment.patient.name}
                            </p>
                            <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {appointment.start_time.substring(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {appointment.patient.phone}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {typeLabels[appointment.type] || appointment.type}
                              </Badge>
                              <Badge className={cn("text-xs", status?.bgColor, status?.color)}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status?.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        
                        <Button 
                          onClick={() => openAppointmentPanel(appointment)}
                          disabled={!!inProgressAppointment}
                          className="flex-shrink-0"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Iniciar Atendimento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Appointments */}
        {completedAppointments.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Atendimentos concluídos ({completedAppointments.length})
            </h2>
            
            <div className="space-y-2">
              {completedAppointments.map((appointment) => (
                <Card key={appointment.id} className="opacity-70 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => openAppointmentPanel(appointment)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {appointment.patient.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.start_time.substring(0, 5)} - {typeLabels[appointment.type]}
                            {appointment.duration_minutes && ` • ${appointment.duration_minutes}min`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Concluído
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Appointment Panel */}
      {selectedAppointment && professional && (
        <AppointmentPanel
          isOpen={appointmentPanelOpen}
          appointment={selectedAppointment}
          professionalId={professional.id}
          clinicId={professional.clinic_id}
          onClose={() => {
            setAppointmentPanelOpen(false);
            setSelectedAppointment(null);
          }}
          onUpdate={handleAppointmentUpdate}
        />
      )}
    </div>
  );
}
