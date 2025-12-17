import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  FileText,
  ClipboardList,
  Pill,
  History,
  Save,
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
  patient: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
}

interface MedicalRecord {
  id: string;
  record_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription: string | null;
  notes: string | null;
}

const statusConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  scheduled: { icon: AlertCircle, color: "text-warning", bgColor: "bg-warning/10", label: "Agendado" },
  confirmed: { icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10", label: "Confirmado" },
  in_progress: { icon: Play, color: "text-info", bgColor: "bg-info/10", label: "Em atendimento" },
  completed: { icon: CheckCircle2, color: "text-muted-foreground", bgColor: "bg-muted", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Não compareceu" },
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Medical records state
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false);
  const [selectedAppointmentForRecords, setSelectedAppointmentForRecords] = useState<Appointment | null>(null);
  const [patientHistory, setPatientHistory] = useState<MedicalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordForm, setRecordForm] = useState({
    chief_complaint: "",
    diagnosis: "",
    treatment_plan: "",
    prescription: "",
    notes: "",
  });
  
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
        patient:patients (id, name, phone, email)
      `)
      .eq('professional_id', professionalId)
      .eq('clinic_id', clinicId)
      .eq('appointment_date', today)
      .in('status', ['scheduled', 'confirmed', 'in_progress', 'completed'])
      .order('start_time', { ascending: true });

    if (!error && data) {
      setAppointments(data.map(apt => ({
        ...apt,
        patient: apt.patient as { id: string; name: string; phone: string; email: string | null }
      })));
    }
  };

  const handleStartAppointment = async (appointmentId: string) => {
    if (!professional) return;
    
    setActionLoading(appointmentId);
    
    const { error } = await supabase
      .from('appointments')
      .update({ 
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', appointmentId);

    if (error) {
      toast({
        title: "Erro ao iniciar atendimento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Atendimento iniciado",
        description: "Bom atendimento!",
      });
      await loadAppointments(professional.id, professional.clinic_id);
    }
    
    setActionLoading(null);
  };

  const handleEndAppointment = async (appointmentId: string) => {
    if (!professional) return;
    
    setActionLoading(appointmentId);
    
    const { error } = await supabase
      .from('appointments')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', appointmentId);

    if (error) {
      toast({
        title: "Erro ao finalizar atendimento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Atendimento finalizado",
        description: "Consulta concluída com sucesso!",
      });
      await loadAppointments(professional.id, professional.clinic_id);
    }
    
    setActionLoading(null);
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

  const openMedicalRecords = async (appointment: Appointment) => {
    setSelectedAppointmentForRecords(appointment);
    setRecordsDialogOpen(true);
    setRecordForm({
      chief_complaint: "",
      diagnosis: "",
      treatment_plan: "",
      prescription: "",
      notes: "",
    });
    
    // Load patient history
    await loadPatientHistory(appointment.patient_id);
  };

  const loadPatientHistory = async (patientId: string) => {
    if (!professional) return;
    
    setLoadingRecords(true);
    
    const { data, error } = await supabase
      .from('medical_records')
      .select('id, record_date, chief_complaint, diagnosis, treatment_plan, prescription, notes')
      .eq('patient_id', patientId)
      .eq('clinic_id', professional.clinic_id)
      .order('record_date', { ascending: false })
      .limit(10);

    if (!error && data) {
      setPatientHistory(data);
    }
    
    setLoadingRecords(false);
  };

  const handleSaveRecord = async () => {
    if (!professional || !selectedAppointmentForRecords) return;
    
    setSavingRecord(true);
    
    const { error } = await supabase
      .from('medical_records')
      .insert({
        clinic_id: professional.clinic_id,
        patient_id: selectedAppointmentForRecords.patient_id,
        professional_id: professional.id,
        appointment_id: selectedAppointmentForRecords.id,
        record_date: today,
        chief_complaint: recordForm.chief_complaint || null,
        diagnosis: recordForm.diagnosis || null,
        treatment_plan: recordForm.treatment_plan || null,
        prescription: recordForm.prescription || null,
        notes: recordForm.notes || null,
      });

    if (error) {
      toast({
        title: "Erro ao salvar prontuário",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Prontuário salvo",
        description: "Registro médico salvo com sucesso!",
      });
      setRecordsDialogOpen(false);
      await loadPatientHistory(selectedAppointmentForRecords.patient_id);
    }
    
    setSavingRecord(false);
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
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => openMedicalRecords(inProgressAppointment)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Prontuário
                  </Button>
                  <Button 
                    size="lg"
                    onClick={() => handleEndAppointment(inProgressAppointment.id)}
                    disabled={actionLoading === inProgressAppointment.id}
                    className="bg-success hover:bg-success/90"
                  >
                    {actionLoading === inProgressAppointment.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Finalizar Atendimento
                  </Button>
                </div>
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
                          onClick={() => handleStartAppointment(appointment.id)}
                          disabled={actionLoading === appointment.id || !!inProgressAppointment}
                          className="flex-shrink-0"
                        >
                          {actionLoading === appointment.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
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
                <Card key={appointment.id} className="opacity-70">
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

      {/* Medical Records Dialog */}
      <Dialog open={recordsDialogOpen} onOpenChange={setRecordsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Prontuário - {selectedAppointmentForRecords?.patient.name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="novo" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="novo" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Novo Registro
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico ({patientHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="novo" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="chief_complaint">Queixa Principal</Label>
                <Textarea
                  id="chief_complaint"
                  value={recordForm.chief_complaint}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, chief_complaint: e.target.value }))}
                  placeholder="Descreva a queixa principal do paciente..."
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="diagnosis">Diagnóstico</Label>
                <Textarea
                  id="diagnosis"
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, diagnosis: e.target.value }))}
                  placeholder="Hipótese diagnóstica ou diagnóstico..."
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="treatment_plan">Plano de Tratamento</Label>
                <Textarea
                  id="treatment_plan"
                  value={recordForm.treatment_plan}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, treatment_plan: e.target.value }))}
                  placeholder="Orientações e plano terapêutico..."
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="prescription" className="flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  Prescrição
                </Label>
                <Textarea
                  id="prescription"
                  value={recordForm.prescription}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, prescription: e.target.value }))}
                  placeholder="Medicamentos prescritos..."
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações adicionais..."
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveRecord} disabled={savingRecord}>
                  {savingRecord ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Prontuário
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              {loadingRecords ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : patientHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum registro anterior encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patientHistory.map((record) => (
                    <Card key={record.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {new Date(record.record_date).toLocaleDateString('pt-BR')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        {record.chief_complaint && (
                          <div>
                            <span className="font-medium">Queixa:</span> {record.chief_complaint}
                          </div>
                        )}
                        {record.diagnosis && (
                          <div>
                            <span className="font-medium">Diagnóstico:</span> {record.diagnosis}
                          </div>
                        )}
                        {record.treatment_plan && (
                          <div>
                            <span className="font-medium">Tratamento:</span> {record.treatment_plan}
                          </div>
                        )}
                        {record.prescription && (
                          <div>
                            <span className="font-medium">Prescrição:</span> {record.prescription}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
