import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  Loader2,
  ChevronRight,
  Stethoscope,
  Pill,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface MedicalRecord {
  id: string;
  record_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription: string | null;
  professional: { name: string } | null;
}

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  patient: { id: string; name: string };
  professional: { name: string };
}

export default function MedicalRecordsPage() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    chief_complaint: "",
    history_present_illness: "",
    physical_examination: "",
    diagnosis: "",
    treatment_plan: "",
    prescription: "",
    notes: "",
  });

  useEffect(() => {
    if (currentClinic) {
      fetchPatients();
      fetchPendingAppointments();
    }
  }, [currentClinic]);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientRecords();
    }
  }, [selectedPatient]);

  const fetchPatients = async () => {
    if (!currentClinic) return;
    
    const { data } = await supabase
      .from('patients')
      .select('id, name, phone')
      .eq('clinic_id', currentClinic.id)
      .order('name');

    setPatients(data || []);
    setLoading(false);
  };

  const fetchPatientRecords = async () => {
    if (!currentClinic || !selectedPatient) return;

    const { data } = await supabase
      .from('medical_records')
      .select(`
        id,
        record_date,
        chief_complaint,
        diagnosis,
        treatment_plan,
        prescription,
        professional:professionals (name)
      `)
      .eq('clinic_id', currentClinic.id)
      .eq('patient_id', selectedPatient.id)
      .order('record_date', { ascending: false });

    setRecords(data as MedicalRecord[] || []);
  };

  const fetchPendingAppointments = async () => {
    if (!currentClinic) return;

    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        patient:patients (id, name),
        professional:professionals (name)
      `)
      .eq('clinic_id', currentClinic.id)
      .eq('status', 'confirmed')
      .lte('appointment_date', today)
      .order('appointment_date', { ascending: false })
      .limit(10);

    setPendingAppointments(data as Appointment[] || []);
  };

  const handleCreateRecord = async () => {
    if (!currentClinic || !selectedPatient) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('medical_records')
        .insert({
          clinic_id: currentClinic.id,
          patient_id: selectedPatient.id,
          appointment_id: selectedAppointment || null,
          ...formData,
        });

      if (error) throw error;

      // Update appointment status to completed if linked
      if (selectedAppointment) {
        await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', selectedAppointment);
      }

      toast({ title: "Prontuário salvo com sucesso!" });
      setDialogOpen(false);
      setFormData({
        chief_complaint: "",
        history_present_illness: "",
        physical_examination: "",
        diagnosis: "",
        treatment_plan: "",
        prescription: "",
        notes: "",
      });
      setSelectedAppointment("");
      fetchPatientRecords();
      fetchPendingAppointments();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  const startRecordFromAppointment = (appointment: Appointment) => {
    const patient = patients.find(p => p.id === appointment.patient.id);
    if (patient) {
      setSelectedPatient(patient);
      setSelectedAppointment(appointment.id);
      setDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prontuário Eletrônico</h1>
          <p className="text-muted-foreground">
            Registre e consulte o histórico médico dos pacientes
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Pacientes
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPatient?.id === patient.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-foreground">{patient.name}</p>
                  <p className="text-sm text-muted-foreground">{patient.phone}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Nenhum paciente encontrado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Patient Records */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedPatient ? `Histórico - ${selectedPatient.name}` : "Selecione um paciente"}
              </CardTitle>
              {selectedPatient && (
                <CardDescription>
                  {records.length} registro(s) encontrado(s)
                </CardDescription>
              )}
            </div>
            {selectedPatient && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Registro
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedPatient ? (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um paciente para ver o histórico</p>
              </div>
            ) : records.length > 0 ? (
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {new Date(record.record_date).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.professional?.name || "Profissional não informado"}
                        </p>
                      </div>
                      <Badge variant="outline">Prontuário</Badge>
                    </div>
                    {record.chief_complaint && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Queixa Principal</p>
                        <p className="text-foreground">{record.chief_complaint}</p>
                      </div>
                    )}
                    {record.diagnosis && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Diagnóstico</p>
                        <p className="text-foreground">{record.diagnosis}</p>
                      </div>
                    )}
                    {record.prescription && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        <Pill className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{record.prescription}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum registro encontrado</p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro registro
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Appointments for Quick Access */}
      {pendingAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Consultas Aguardando Registro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingAppointments.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => startRecordFromAppointment(apt)}
                  className="p-3 border border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{apt.patient?.name}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(apt.appointment_date).toLocaleDateString('pt-BR')} às {apt.start_time.slice(0, 5)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Record Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Registro - {selectedPatient?.name}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="queixa" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="queixa">Queixa</TabsTrigger>
              <TabsTrigger value="exame">Exame</TabsTrigger>
              <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
              <TabsTrigger value="tratamento">Tratamento</TabsTrigger>
            </TabsList>
            
            <TabsContent value="queixa" className="space-y-4 mt-4">
              <div>
                <Label>Queixa Principal</Label>
                <Textarea
                  value={formData.chief_complaint}
                  onChange={(e) => setFormData(prev => ({ ...prev, chief_complaint: e.target.value }))}
                  placeholder="Descreva a queixa principal do paciente..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
              <div>
                <Label>História da Doença Atual</Label>
                <Textarea
                  value={formData.history_present_illness}
                  onChange={(e) => setFormData(prev => ({ ...prev, history_present_illness: e.target.value }))}
                  placeholder="Descreva a evolução dos sintomas..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="exame" className="space-y-4 mt-4">
              <div>
                <Label>Exame Físico</Label>
                <Textarea
                  value={formData.physical_examination}
                  onChange={(e) => setFormData(prev => ({ ...prev, physical_examination: e.target.value }))}
                  placeholder="Registre os achados do exame físico..."
                  className="mt-1.5 min-h-[200px]"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="diagnostico" className="space-y-4 mt-4">
              <div>
                <Label>Diagnóstico</Label>
                <Textarea
                  value={formData.diagnosis}
                  onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
                  placeholder="Diagnóstico ou hipótese diagnóstica..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="tratamento" className="space-y-4 mt-4">
              <div>
                <Label>Plano de Tratamento</Label>
                <Textarea
                  value={formData.treatment_plan}
                  onChange={(e) => setFormData(prev => ({ ...prev, treatment_plan: e.target.value }))}
                  placeholder="Descreva o plano de tratamento..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
              <div>
                <Label>Prescrição</Label>
                <Textarea
                  value={formData.prescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, prescription: e.target.value }))}
                  placeholder="Medicamentos e orientações..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações adicionais..."
                  className="mt-1.5"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateRecord} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Prontuário
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
