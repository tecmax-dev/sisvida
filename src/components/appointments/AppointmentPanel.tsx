import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Clock,
  CheckCircle2,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  ClipboardList,
  Pill,
  History,
  Save,
  Loader2,
  Stethoscope,
  Timer,
  Lock,
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
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
  patient: Patient;
}

interface MedicalRecord {
  id: string;
  record_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription: string | null;
  notes: string | null;
  created_at: string;
}

interface Anamnesis {
  id: string;
  blood_type: string | null;
  allergies: string | null;
  chronic_diseases: string | null;
  current_medications: string | null;
  previous_surgeries: string | null;
  family_history: string | null;
  smoking: boolean | null;
  alcohol: boolean | null;
  physical_activity: boolean | null;
  additional_notes: string | null;
  filled_at: string;
}

interface AppointmentPanelProps {
  appointment: Appointment;
  professionalId: string;
  clinicId: string;
  onClose: () => void;
  onUpdate: () => void;
  isOpen: boolean;
}

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
};

export function AppointmentPanel({
  appointment,
  professionalId,
  clinicId,
  onClose,
  onUpdate,
  isOpen,
}: AppointmentPanelProps) {
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState<string>("00:00:00");
  const [loading, setLoading] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [medicalHistory, setMedicalHistory] = useState<MedicalRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [recordForm, setRecordForm] = useState({
    chief_complaint: "",
    diagnosis: "",
    treatment_plan: "",
    prescription: "",
    notes: "",
  });

  const isCompleted = appointment.status === "completed";
  const isInProgress = appointment.status === "in_progress";

  // Real-time timer based on started_at
  useEffect(() => {
    if (!isInProgress || !appointment.started_at) return;

    const updateTimer = () => {
      const startTime = new Date(appointment.started_at!).getTime();
      const now = Date.now();
      const diff = Math.floor((now - startTime) / 1000);
      
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isInProgress, appointment.started_at]);

  // Load patient data
  useEffect(() => {
    if (isOpen) {
      loadPatientData();
    }
  }, [isOpen, appointment.patient_id]);

  const loadPatientData = async () => {
    setLoadingData(true);
    
    try {
      // Load anamnesis
      const { data: anamnesisData } = await supabase
        .from("anamnesis")
        .select("*")
        .eq("patient_id", appointment.patient_id)
        .eq("clinic_id", clinicId)
        .order("filled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anamnesisData) {
        setAnamnesis(anamnesisData);
      }

      // Load medical history
      const { data: historyData } = await supabase
        .from("medical_records")
        .select("*")
        .eq("patient_id", appointment.patient_id)
        .eq("clinic_id", clinicId)
        .order("record_date", { ascending: false })
        .limit(10);

      if (historyData) {
        setMedicalHistory(historyData);
      }
    } catch (error) {
      console.error("Error loading patient data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleStartAppointment = async () => {
    setLoading(true);
    
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", appointment.id);

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
      onUpdate();
    }
    
    setLoading(false);
  };

  const handleEndAppointment = async () => {
    setLoading(true);
    
    const startTime = appointment.started_at ? new Date(appointment.started_at).getTime() : Date.now();
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - startTime) / 60000);

    const { error } = await supabase
      .from("appointments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq("id", appointment.id);

    if (error) {
      toast({
        title: "Erro ao finalizar atendimento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Atendimento finalizado",
        description: `Duração: ${durationMinutes} minutos`,
      });
      onUpdate();
      onClose();
    }
    
    setLoading(false);
  };

  const handleSaveRecord = async () => {
    setSavingRecord(true);
    
    const { error } = await supabase
      .from("medical_records")
      .insert({
        clinic_id: clinicId,
        patient_id: appointment.patient_id,
        professional_id: professionalId,
        appointment_id: appointment.id,
        record_date: new Date().toISOString().split("T")[0],
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
      setRecordForm({
        chief_complaint: "",
        diagnosis: "",
        treatment_plan: "",
        prescription: "",
        notes: "",
      });
      loadPatientData();
    }
    
    setSavingRecord(false);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-primary" />
            Painel de Atendimento
            {isCompleted && (
              <Badge variant="secondary" className="ml-2">
                <Lock className="h-3 w-3 mr-1" />
                Finalizado
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Patient Info & Timer */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{appointment.patient.name}</h3>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {appointment.patient.phone}
                  </span>
                  {appointment.patient.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {appointment.patient.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline">{typeLabels[appointment.type] || appointment.type}</Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(appointment.appointment_date).toLocaleDateString("pt-BR")}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {appointment.start_time.substring(0, 5)}
              </Badge>
            </div>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center justify-center p-4 bg-background rounded-lg border min-w-[160px]">
            {isInProgress ? (
              <>
                <Timer className="h-5 w-5 text-info mb-1" />
                <span className="text-2xl font-mono font-bold text-info">{elapsedTime}</span>
                <span className="text-xs text-muted-foreground">Tempo de atendimento</span>
              </>
            ) : isCompleted && appointment.duration_minutes ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-success mb-1" />
                <span className="text-xl font-semibold text-success">
                  {formatDuration(appointment.duration_minutes)}
                </span>
                <span className="text-xs text-muted-foreground">Duração total</span>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-sm text-muted-foreground">Aguardando início</span>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <ScrollArea className="flex-1">
          <Tabs defaultValue="prontuario" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="prontuario">
                <FileText className="h-4 w-4 mr-1.5" />
                Prontuário
              </TabsTrigger>
              <TabsTrigger value="anamnese">
                <ClipboardList className="h-4 w-4 mr-1.5" />
                Anamnese
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History className="h-4 w-4 mr-1.5" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="receituario">
                <Pill className="h-4 w-4 mr-1.5" />
                Receituário
              </TabsTrigger>
            </TabsList>

            {/* Prontuário Tab */}
            <TabsContent value="prontuario" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Queixa Principal</Label>
                  <Textarea
                    value={recordForm.chief_complaint}
                    onChange={(e) => setRecordForm({ ...recordForm, chief_complaint: e.target.value })}
                    placeholder="Descreva a queixa principal do paciente..."
                    className="min-h-[100px]"
                    disabled={isCompleted}
                  />
                </div>
                <div>
                  <Label>Diagnóstico</Label>
                  <Textarea
                    value={recordForm.diagnosis}
                    onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })}
                    placeholder="Diagnóstico..."
                    className="min-h-[100px]"
                    disabled={isCompleted}
                  />
                </div>
                <div>
                  <Label>Plano de Tratamento</Label>
                  <Textarea
                    value={recordForm.treatment_plan}
                    onChange={(e) => setRecordForm({ ...recordForm, treatment_plan: e.target.value })}
                    placeholder="Plano de tratamento..."
                    className="min-h-[100px]"
                    disabled={isCompleted}
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                    placeholder="Observações adicionais..."
                    className="min-h-[100px]"
                    disabled={isCompleted}
                  />
                </div>
              </div>

              {!isCompleted && (
                <Button 
                  onClick={handleSaveRecord} 
                  disabled={savingRecord}
                  className="w-full"
                >
                  {savingRecord ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Prontuário
                </Button>
              )}
            </TabsContent>

            {/* Anamnese Tab */}
            <TabsContent value="anamnese" className="mt-4">
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : anamnesis ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Informações Gerais</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      {anamnesis.blood_type && (
                        <p><strong>Tipo Sanguíneo:</strong> {anamnesis.blood_type}</p>
                      )}
                      <p><strong>Tabagismo:</strong> {anamnesis.smoking ? "Sim" : "Não"}</p>
                      <p><strong>Álcool:</strong> {anamnesis.alcohol ? "Sim" : "Não"}</p>
                      <p><strong>Atividade Física:</strong> {anamnesis.physical_activity ? "Sim" : "Não"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Alergias</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {anamnesis.allergies || "Nenhuma informada"}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Doenças Crônicas</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {anamnesis.chronic_diseases || "Nenhuma informada"}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Medicamentos em Uso</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {anamnesis.current_medications || "Nenhum informado"}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Cirurgias Anteriores</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {anamnesis.previous_surgeries || "Nenhuma informada"}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Histórico Familiar</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {anamnesis.family_history || "Nenhum informado"}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma anamnese registrada para este paciente</p>
                </div>
              )}
            </TabsContent>

            {/* Histórico Tab */}
            <TabsContent value="historico" className="mt-4">
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : medicalHistory.length > 0 ? (
                <div className="space-y-3">
                  {medicalHistory.map((record) => (
                    <Card key={record.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">
                            {new Date(record.record_date).toLocaleDateString("pt-BR")}
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {new Date(record.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        {record.chief_complaint && (
                          <p><strong>Queixa:</strong> {record.chief_complaint}</p>
                        )}
                        {record.diagnosis && (
                          <p><strong>Diagnóstico:</strong> {record.diagnosis}</p>
                        )}
                        {record.treatment_plan && (
                          <p><strong>Tratamento:</strong> {record.treatment_plan}</p>
                        )}
                        {record.prescription && (
                          <p><strong>Prescrição:</strong> {record.prescription}</p>
                        )}
                        {record.notes && (
                          <p><strong>Obs:</strong> {record.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum histórico de atendimentos anteriores</p>
                </div>
              )}
            </TabsContent>

            {/* Receituário Tab */}
            <TabsContent value="receituario" className="mt-4">
              <div>
                <Label>Prescrição Médica</Label>
                <Textarea
                  value={recordForm.prescription}
                  onChange={(e) => setRecordForm({ ...recordForm, prescription: e.target.value })}
                  placeholder="Descreva a prescrição médica..."
                  className="min-h-[200px]"
                  disabled={isCompleted}
                />
              </div>
              {!isCompleted && (
                <Button 
                  onClick={handleSaveRecord} 
                  disabled={savingRecord}
                  className="w-full mt-4"
                >
                  {savingRecord ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Receituário
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        {/* Footer Actions */}
        <Separator className="my-2" />
        <div className="flex justify-between gap-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <div className="flex gap-2">
            {!isInProgress && !isCompleted && (
              <Button onClick={handleStartAppointment} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Iniciar Atendimento
              </Button>
            )}
            {isInProgress && (
              <Button 
                onClick={handleEndAppointment} 
                disabled={loading}
                className="bg-success hover:bg-success/90"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Finalizar Atendimento
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
