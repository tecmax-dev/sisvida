import { useState, useEffect } from "react";
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
  Printer,
  Send,
  RefreshCw,
  FlaskConical,
  Award,
  ClipboardCheck,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PrintDialog } from "@/components/medical/PrintDialog";
import { calculateAge } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sendWhatsAppDocument } from "@/lib/whatsapp";
import { generatePrescriptionPDF } from "@/lib/prescriptionExportUtils";

interface Patient {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
}

interface MedicalRecord {
  id: string;
  record_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription: string | null;
  created_at: string;
  professional: { id: string; name: string; specialty: string | null; registration_number: string | null } | null;
}

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  patient: { id: string; name: string };
  professional: { id: string; name: string };
}

interface MedicalDocument {
  id: string;
  document_type: string;
  content: string;
  additional_info: Record<string, unknown> | null;
  document_date: string;
  sent_via_whatsapp: boolean;
  sent_at: string | null;
  sent_to_phone: string | null;
  created_at: string;
  professional_id: string | null;
}

export default function MedicalRecordsPage() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<string>("");
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);

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
      fetchPatientDocuments();
    }
  }, [selectedPatient]);

  const fetchPatients = async () => {
    if (!currentClinic) return;
    
    const { data } = await supabase
      .from('patients')
      .select('id, name, phone, birth_date')
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
        created_at,
        professional:professionals (id, name, specialty, registration_number)
      `)
      .eq('clinic_id', currentClinic.id)
      .eq('patient_id', selectedPatient.id)
      .order('created_at', { ascending: false });

    setRecords(data as MedicalRecord[] || []);
  };

  const fetchPatientDocuments = async () => {
    if (!currentClinic || !selectedPatient) return;

    const { data } = await supabase
      .from('medical_documents')
      .select('*')
      .eq('clinic_id', currentClinic.id)
      .eq('patient_id', selectedPatient.id)
      .order('created_at', { ascending: false });

    setDocuments(data as MedicalDocument[] || []);
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
        professional:professionals (id, name)
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

  const handlePrintRecord = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setPrintDialogOpen(true);
  };

  const handleSendWhatsApp = async (record: MedicalRecord) => {
    if (!currentClinic || !selectedPatient) return;
    
    if (!record.prescription?.trim()) {
      toast({ title: "Este registro não possui prescrição", variant: "destructive" });
      return;
    }

    if (!selectedPatient.phone) {
      toast({ title: "Paciente não possui telefone cadastrado", variant: "destructive" });
      return;
    }

    setSendingWhatsApp(record.id);
    try {
      const { base64, fileName } = await generatePrescriptionPDF({
        clinic: {
          name: currentClinic.name,
          address: currentClinic.address || undefined,
          phone: currentClinic.phone || undefined,
          cnpj: currentClinic.cnpj || undefined,
        },
        patient: {
          name: selectedPatient.name,
        },
        professional: {
          name: record.professional?.name || 'Profissional',
          specialty: record.professional?.specialty || undefined,
          registration_number: record.professional?.registration_number || undefined,
        },
        prescription: {
          content: record.prescription,
          created_at: record.record_date,
        },
      });

      const result = await sendWhatsAppDocument({
        phone: selectedPatient.phone,
        clinicId: currentClinic.id,
        pdfBase64: base64,
        fileName,
        caption: [
          `📋 *Receituário Médico*`,
          ``,
          `Olá ${selectedPatient.name}! 👋`,
          ``,
          `Segue em anexo seu receituário.`,
          ``,
          `📅 *Data:* ${format(parseISO(record.record_date), "dd/MM/yyyy", { locale: ptBR })}`,
          `👨‍⚕️ *Profissional:* ${record.professional?.name || 'Profissional'}`,
          `🏥 *Clínica:* ${currentClinic.name}`,
          ``,
          `⚠️ *Atenção:* Siga as orientações do profissional de saúde. Em caso de dúvidas, entre em contato conosco.`,
          ``,
          `Atenciosamente,`,
          `Equipe ${currentClinic.name}`,
        ].join('\n'),
      });

      if (result.success) {
        toast({ title: "Receituário enviado com sucesso!" });
      } else {
        toast({ title: "Erro ao enviar", description: result.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSendingWhatsApp(null);
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

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'prescription': return 'Receituário';
      case 'certificate': return 'Atestado';
      case 'attendance': return 'Comparecimento';
      case 'exam_request': return 'Exames';
      default: return type;
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case 'prescription': return <Pill className="h-4 w-4" />;
      case 'certificate': return <Award className="h-4 w-4" />;
      case 'attendance': return <ClipboardCheck className="h-4 w-4" />;
      case 'exam_request': return <FlaskConical className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getDocumentTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case 'prescription': return 'default';
      case 'certificate': return 'secondary';
      case 'attendance': return 'outline';
      case 'exam_request': return 'secondary';
      default: return 'outline';
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
                <CardDescription className="flex items-center gap-2">
                  {selectedPatient.birth_date && (
                    <Badge variant="outline">{calculateAge(selectedPatient.birth_date)} anos</Badge>
                  )}
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
              <Accordion type="single" collapsible className="space-y-2">
                {records.map((record) => (
                  <AccordionItem key={record.id} value={record.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="text-left">
                          <p className="font-medium text-foreground">
                            {format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {record.professional?.name || "Profissional não informado"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {record.prescription && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendWhatsApp(record)}
                              disabled={sendingWhatsApp === record.id || !selectedPatient?.phone}
                              title={!selectedPatient?.phone ? "Paciente sem telefone" : "Enviar receituário via WhatsApp"}
                            >
                              {sendingWhatsApp === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintRecord(record)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-4 pt-2">
                        {record.chief_complaint && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Queixa Principal</p>
                            <p className="text-foreground mt-1">{record.chief_complaint}</p>
                          </div>
                        )}
                        {record.diagnosis && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Diagnóstico</p>
                            <p className="text-foreground mt-1">{record.diagnosis}</p>
                          </div>
                        )}
                        {record.treatment_plan && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Plano de Tratamento</p>
                            <p className="text-foreground mt-1">{record.treatment_plan}</p>
                          </div>
                        )}
                        {record.prescription && (
                          <div className="flex items-start gap-2 pt-3 border-t border-border">
                            <Pill className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Prescrição</p>
                              <p className="text-foreground mt-1">{record.prescription}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
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

      {/* Issued Documents History */}
      {selectedPatient && documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentos Emitidos
            </CardTitle>
            <CardDescription>
              Histórico de documentos emitidos para este paciente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getDocumentTypeIcon(doc.document_type)}
                      <Badge variant={getDocumentTypeBadgeVariant(doc.document_type)}>
                        {getDocumentTypeLabel(doc.document_type)}
                      </Badge>
                    </div>
                    {doc.sent_via_whatsapp && (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                        ✓ WhatsApp
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {format(new Date(doc.document_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-foreground mt-1 line-clamp-2">
                    {doc.content}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                    {new Date(apt.appointment_date + "T12:00:00").toLocaleDateString('pt-BR')} às {apt.start_time.slice(0, 5)}
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

      {/* Print Dialog */}
      {selectedPatient && currentClinic && selectedRecord && (
        <PrintDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          clinic={{
            name: currentClinic.name,
            address: currentClinic.address || undefined,
            phone: currentClinic.phone || undefined,
            cnpj: currentClinic.cnpj || undefined,
            logo_url: currentClinic.logo_url || undefined,
          }}
          clinicId={currentClinic.id}
          patient={{ name: selectedPatient.name, phone: selectedPatient.phone }}
          patientId={selectedPatient.id}
          professional={selectedRecord.professional ? {
            name: selectedRecord.professional.name,
            specialty: selectedRecord.professional.specialty || undefined,
            registration_number: selectedRecord.professional.registration_number || undefined,
          } : undefined}
          professionalId={selectedRecord.professional?.id}
          medicalRecordId={selectedRecord.id}
          initialPrescription={selectedRecord.prescription || ""}
          date={selectedRecord.record_date}
          onDocumentSaved={() => fetchPatientDocuments()}
        />
      )}
    </div>
  );
}
