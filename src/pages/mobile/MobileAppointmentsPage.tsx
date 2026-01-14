import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Clock, 
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  notes: string | null;
  dependent_id: string | null;
  professional: {
    id: string;
    name: string;
    specialty: string | null;
  };
  procedure: {
    id: string;
    name: string;
  } | null;
  dependent?: {
    id: string;
    name: string;
  } | null;
}

export default function MobileAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dependentAppointments, setDependentAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("mine");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const patientId = sessionStorage.getItem('mobile_patient_id');
      const clinicId = sessionStorage.getItem('mobile_clinic_id');

      if (!patientId || !clinicId) {
        navigate("/app/login");
        return;
      }

      // Fetch my appointments (titular)
      const { data: myAppointments, error: myError } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, start_time, end_time, status, type, notes, dependent_id,
          professional:professionals(id, name, specialty),
          procedure:procedures(id, name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .is("dependent_id", null)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (myError) {
        console.error("Error fetching appointments:", myError);
      } else {
        setAppointments(myAppointments as unknown as Appointment[]);
      }

      // Fetch dependent appointments
      const { data: depAppointments, error: depError } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, start_time, end_time, status, type, notes, dependent_id,
          professional:professionals(id, name, specialty),
          procedure:procedures(id, name),
          dependent:patient_dependents!appointments_dependent_id_fkey(id, name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .not("dependent_id", "is", null)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (depError) {
        console.error("Error fetching dependent appointments:", depError);
      } else {
        setDependentAppointments(depAppointments as unknown as Appointment[]);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      scheduled: { label: "Agendado", variant: "default", icon: <Calendar className="h-3 w-3" /> },
      confirmed: { label: "Confirmado", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
      attended: { label: "Atendido", variant: "secondary", icon: <CheckCircle2 className="h-3 w-3" /> },
      completed: { label: "Concluído", variant: "secondary", icon: <CheckCircle2 className="h-3 w-3" /> },
      cancelled: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      no_show: { label: "Falta", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
      blocked: { label: "Bloqueado", variant: "outline", icon: <XCircle className="h-3 w-3" /> },
    };

    const config = statusConfig[status] || { label: status, variant: "outline", icon: null };
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 text-xs">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const renderAppointmentCard = (appointment: Appointment) => {
    const appointmentDate = parseISO(appointment.appointment_date);
    
    return (
      <Card key={appointment.id} className="mb-3 border-l-4 border-l-emerald-500">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-medium text-foreground">
                {appointment.procedure?.name || appointment.type}
              </h3>
              {appointment.dependent && (
                <p className="text-sm text-muted-foreground">
                  Dependente: {appointment.dependent.name}
                </p>
              )}
            </div>
            {getStatusBadge(appointment.status)}
          </div>
          
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {format(appointmentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>
                {appointment.professional.name}
                {appointment.professional.specialty && ` • ${appointment.professional.specialty}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <img 
        src="/empty-appointments.svg" 
        alt="Sem registros"
        className="w-48 h-48 mb-6 opacity-80"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-xl font-semibold text-foreground mb-2">Sem registro!</h3>
      <p className="text-muted-foreground text-center">
        Não encontramos registros no momento.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
        <button onClick={() => navigate("/app")} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendamentos</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full rounded-none border-b h-12 bg-background p-0">
          <TabsTrigger 
            value="mine" 
            className="flex-1 h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
          >
            Meus agendamentos
          </TabsTrigger>
          <TabsTrigger 
            value="dependents" 
            className="flex-1 h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
          >
            Meus dependentes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : appointments.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="p-4">
                {appointments.map(renderAppointmentCard)}
              </div>
            </ScrollArea>
          ) : (
            renderEmptyState()
          )}
        </TabsContent>

        <TabsContent value="dependents" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : dependentAppointments.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="p-4">
                {dependentAppointments.map(renderAppointmentCard)}
              </div>
            </ScrollArea>
          ) : (
            renderEmptyState()
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Button */}
      <Button
        onClick={() => navigate("/app/agendar")}
        className="fixed bottom-6 right-6 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg flex items-center gap-2 px-6"
      >
        <Plus className="h-5 w-5" />
        Agendar
      </Button>
    </div>
  );
}
