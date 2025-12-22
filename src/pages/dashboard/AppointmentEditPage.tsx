import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Calendar, Clock, User, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleScheduleValidationError } from "@/lib/scheduleValidation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const appointmentTypes = [
  { value: "first_visit", label: "Primeira Consulta" },
  { value: "return", label: "Retorno" },
  { value: "exam", label: "Exame" },
  { value: "procedure", label: "Procedimento" },
  { value: "telemedicine", label: "Telemedicina" },
];

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  notes: string | null;
  patient_id: string;
  professional_id: string;
  patient: { id: string; name: string; phone: string } | null;
  professional: { id: string; name: string } | null;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
}

export default function AppointmentEditPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  
  const returnTo = searchParams.get('returnTo') || '/dashboard/calendar';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  
  // Form state
  const [patientId, setPatientId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [type, setType] = useState("first_visit");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (currentClinic && id) {
      fetchAppointment();
      fetchData();
    }
  }, [currentClinic, id]);

  const fetchAppointment = async () => {
    if (!currentClinic || !id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          type,
          status,
          notes,
          patient_id,
          professional_id,
          patient:patients (id, name, phone),
          professional:professionals (id, name)
        `)
        .eq('id', id)
        .eq('clinic_id', currentClinic.id)
        .single();

      if (error) throw error;
      
      if (data) {
        const apt = data as unknown as Appointment;
        setAppointment(apt);
        setPatientId(apt.patient_id);
        setProfessionalId(apt.professional_id);
        setAppointmentDate(apt.appointment_date);
        setStartTime(apt.start_time.slice(0, 5));
        setType(apt.type);
        setNotes(apt.notes || "");
      }
    } catch (error) {
      console.error("Error fetching appointment:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados do agendamento.",
        variant: "destructive",
      });
      navigate(returnTo);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!currentClinic) return;
    
    try {
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, name, phone')
        .eq('clinic_id', currentClinic.id)
        .order('name');
      
      if (patientsData) setPatients(patientsData);

      const { data: professionalsData } = await supabase
        .from('professionals')
        .select('id, name, specialty')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .order('name');
      
      if (professionalsData) setProfessionals(professionalsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!patientId || !professionalId || !startTime || !appointmentDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!currentClinic || !id) return;

    setSaving(true);

    try {
      const [hours, minutes] = startTime.split(':');
      const endHours = parseInt(hours) + (parseInt(minutes) + 30 >= 60 ? 1 : 0);
      const endMinutes = (parseInt(minutes) + 30) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

      const { error } = await supabase
        .from('appointments')
        .update({
          patient_id: patientId,
          professional_id: professionalId,
          appointment_date: appointmentDate,
          start_time: startTime,
          end_time: endTime,
          type: type as "first_visit" | "return" | "exam" | "procedure" | "telemedicine",
          notes: notes.trim() || null,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Agendamento atualizado",
        description: "As alterações foram salvas com sucesso.",
      });

      navigate(returnTo);
    } catch (error: any) {
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao atualizar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Agendamento não encontrado.</p>
        <Button variant="outline" onClick={() => navigate(returnTo)} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const formattedDate = appointment.appointment_date 
    ? format(parseISO(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(returnTo)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Agendamento</h1>
          <p className="text-muted-foreground">
            {appointment.patient?.name} - {formattedDate}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Detalhes do Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="patient" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Paciente *
                </Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="professional" className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Profissional *
                </Label>
                <Select value={professionalId} onValueChange={setProfessionalId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.name} {prof.specialty && `- ${prof.specialty}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              
              <div>
                <Label htmlFor="time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horário *
                </Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="type">Tipo de Consulta</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre o agendamento"
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(returnTo)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
