import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Paperclip,
  Upload,
  Activity,
  FileHeart,
  FilePlus,
  Users,
} from "lucide-react";
import { usePatientAttachments } from "@/hooks/usePatientAttachments";
import { AttachmentsList } from "@/components/attachments/AttachmentsList";
import { FolderTree } from "@/components/attachments/FolderTree";
import { UploadDialog } from "@/components/attachments/UploadDialog";
import { FilePreviewModal } from "@/components/attachments/FilePreviewModal";
import { AccessLogsModal } from "@/components/attachments/AccessLogsModal";
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
  cpf: string | null;
  birth_date: string | null;
}

// Normalize text for search (remove accents and special chars)
const normalizeForSearch = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

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
  const [searchingPatients, setSearchingPatients] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<string>("");
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printDialogSnapshot, setPrintDialogSnapshot] = useState<{
    clinic: {
      name: string;
      address?: string;
      phone?: string;
      cnpj?: string;
      logo_url?: string;
    };
    clinicId: string;
    patient: { name: string; phone: string };
    patientId: string;
    professional?: { name: string; specialty?: string; registration_number?: string };
    professionalId?: string;
    medicalRecordId?: string;
    initialPrescription?: string;
    date: string;
  } | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);

  useEffect(() => {
    if (!printDialogOpen) return;
    if (!currentClinic || !selectedPatient || !selectedRecord) return;

    setPrintDialogSnapshot({
      clinic: {
        name: currentClinic.name,
        address: currentClinic.address || undefined,
        phone: currentClinic.phone || undefined,
        cnpj: currentClinic.cnpj || undefined,
        logo_url: currentClinic.logo_url || undefined,
      },
      clinicId: currentClinic.id,
      patient: { name: selectedPatient.name, phone: selectedPatient.phone },
      patientId: selectedPatient.id,
      professional: selectedRecord.professional
        ? {
            name: selectedRecord.professional.name,
            specialty: selectedRecord.professional.specialty || undefined,
            registration_number: selectedRecord.professional.registration_number || undefined,
          }
        : undefined,
      professionalId: selectedRecord.professional?.id,
      medicalRecordId: selectedRecord.id,
      initialPrescription: selectedRecord.prescription || "",
      date: selectedRecord.record_date,
    });
  }, [printDialogOpen, currentClinic, selectedPatient, selectedRecord]);
  // Attachments state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<any>(null);
  const [logsAttachment, setLogsAttachment] = useState<any>(null);

  // Use attachments hook
  const {
    folders,
    attachments,
    loading: attachmentsLoading,
    fetchFolders,
    fetchAttachments,
    createFolder,
    renameFolder,
    deleteFolder,
    uploadFiles,
    deleteAttachment,
    moveAttachment,
    logAccess,
    getAccessLogs,
    getFileUrl,
  } = usePatientAttachments(selectedPatient?.id || "");

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
      fetchFolders();
      fetchAttachments(selectedFolderId);
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (selectedPatient) {
      fetchAttachments(selectedFolderId);
    }
  }, [selectedFolderId]);

  const fetchPatients = async (search?: string) => {
    if (!currentClinic) return;
    
    setSearchingPatients(true);
    
    let query = supabase
      .from('patients')
      .select('id, name, phone, cpf, birth_date')
      .eq('clinic_id', currentClinic.id)
      .order('name')
      .limit(25);

    if (search && search.trim()) {
      const normalizedSearch = normalizeForSearch(search);
      const isNumericSearch = /^\d+$/.test(normalizedSearch);
      
      if (isNumericSearch) {
        // Search by CPF or phone
        query = query.or(`cpf.ilike.%${search.replace(/\D/g, '')}%,phone.ilike.%${search.replace(/\D/g, '')}%`);
      } else {
        // Search by name
        query = query.ilike('name', `%${search}%`);
      }
    }

    const { data } = await query;
    setPatients(data || []);
    setLoading(false);
    setSearchingPatients(false);
  };

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      fetchPatients(value);
    }, 300);
  }, [currentClinic]);

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
      // Importante: não misturar registros de dependentes no prontuário do titular
      .is('dependent_id', null)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false });

    setRecords((data as MedicalRecord[]) || []);
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

  // Patients are already filtered from server
  const filteredPatients = patients;

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

  // Attachment handlers
  const handleUpload = async (files: File[], folderId: string | null, description?: string) => {
    await uploadFiles(files, folderId, description);
    fetchAttachments(selectedFolderId);
  };

  const handleViewAttachment = async (attachment: any) => {
    await logAccess(attachment.id, "view");
    setPreviewAttachment(attachment);
  };

  const handleDownloadAttachment = async (attachment: any) => {
    await logAccess(attachment.id, "download");
    const url = await getFileUrl(attachment);
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleMoveAttachment = async (attachmentId: string, newFolderId: string | null): Promise<boolean> => {
    const result = await moveAttachment(attachmentId, newFolderId);
    fetchAttachments(selectedFolderId);
    return result;
  };

  // Stats calculations
  const stats = useMemo(() => {
    const totalRecords = records.length;
    const totalDocuments = documents.length;
    const prescriptions = documents.filter(d => d.document_type === 'prescription').length;
    const certificates = documents.filter(d => d.document_type === 'certificate').length;
    
    return { totalRecords, totalDocuments, prescriptions, certificates };
  }, [records, documents]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prontuário Eletrônico</h1>
          <p className="text-sm text-muted-foreground">
            Registre e consulte o histórico médico dos pacientes
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50 dark:border-blue-800/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{patients.length}</p>
                <p className="text-xs text-muted-foreground">Pacientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200/50 dark:border-emerald-800/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalRecords}</p>
                <p className="text-xs text-muted-foreground">Registros</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-200/50 dark:border-violet-800/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-500/20">
                <Pill className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-violet-600 dark:text-violet-400">{stats.prescriptions}</p>
                <p className="text-xs text-muted-foreground">Receituários</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200/50 dark:border-amber-800/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20">
                <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.certificates}</p>
                <p className="text-xs text-muted-foreground">Atestados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Patient List */}
        <Card className="lg:col-span-1">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Pacientes
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              {searchingPatients && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 pr-8 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 max-h-[600px] overflow-y-auto space-y-1">
            {loading ? (
              <div className="text-center py-6">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedPatient?.id === patient.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-sm text-foreground">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">{patient.phone}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-3 text-sm">
                Nenhum paciente encontrado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Patient Records */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {selectedPatient ? `Histórico - ${selectedPatient.name}` : "Selecione um paciente"}
              </CardTitle>
              {selectedPatient && (
                <CardDescription className="flex items-center gap-2 mt-1">
                  {selectedPatient.birth_date && (
                    <Badge variant="outline" className="text-xs">{calculateAge(selectedPatient.birth_date)} anos</Badge>
                  )}
                  <span className="text-xs">{records.length} registro(s)</span>
                </CardDescription>
              )}
            </div>
            {selectedPatient && (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Novo Registro
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {!selectedPatient ? (
              <div className="text-center py-8 text-muted-foreground">
                <Stethoscope className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Selecione um paciente para ver o histórico</p>
              </div>
            ) : records.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-1">
                {records.map((record) => (
                  <AccordionItem key={record.id} value={record.id} className="border rounded-md px-3">
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div className="text-left">
                          <p className="font-medium text-sm text-foreground">
                            {format(parseISO(record.record_date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {record.professional?.name || "Profissional não informado"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {record.prescription && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleSendWhatsApp(record)}
                              disabled={sendingWhatsApp === record.id || !selectedPatient?.phone}
                              title={!selectedPatient?.phone ? "Paciente sem telefone" : "Enviar receituário via WhatsApp"}
                            >
                              {sendingWhatsApp === record.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handlePrintRecord(record)}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <div className="space-y-2 pt-1">
                        {record.chief_complaint && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Queixa Principal</p>
                            <p className="text-sm text-foreground">{record.chief_complaint}</p>
                          </div>
                        )}
                        {record.diagnosis && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Diagnóstico</p>
                            <p className="text-sm text-foreground">{record.diagnosis}</p>
                          </div>
                        )}
                        {record.treatment_plan && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Plano de Tratamento</p>
                            <p className="text-sm text-foreground">{record.treatment_plan}</p>
                          </div>
                        )}
                        {record.prescription && (
                          <div className="flex items-start gap-2 pt-2 border-t border-border">
                            <Pill className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Prescrição</p>
                              <p className="text-sm text-foreground">{record.prescription}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum registro encontrado</p>
                <Button size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Criar primeiro registro
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Patient Attachments Section */}
      {selectedPatient && (
        <Card>
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Anexos do Paciente
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Exames, documentos e arquivos do paciente
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Enviar Arquivo
            </Button>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {attachmentsLoading ? (
              <div className="text-center py-6">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="grid lg:grid-cols-4 gap-3">
                <div className="lg:col-span-1">
                  <FolderTree
                    folders={folders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={setSelectedFolderId}
                    onCreateFolder={createFolder}
                    onRenameFolder={renameFolder}
                    onDeleteFolder={deleteFolder}
                  />
                </div>
                <div className="lg:col-span-3">
                  <AttachmentsList
                    attachments={attachments}
                    folders={folders}
                    loading={attachmentsLoading}
                    onView={handleViewAttachment}
                    onDownload={handleDownloadAttachment}
                    onDelete={deleteAttachment}
                    onMove={handleMoveAttachment}
                    onViewLogs={(attachment) => setLogsAttachment(attachment)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Issued Documents History */}
      {selectedPatient && documents.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos Emitidos
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Histórico de documentos emitidos para este paciente
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-2.5 border border-border rounded-md hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      {getDocumentTypeIcon(doc.document_type)}
                      <Badge variant={getDocumentTypeBadgeVariant(doc.document_type)} className="text-xs">
                        {getDocumentTypeLabel(doc.document_type)}
                      </Badge>
                    </div>
                    {doc.sent_via_whatsapp && (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1">
                        ✓ WhatsApp
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {format(new Date(doc.document_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-foreground mt-0.5 line-clamp-2">
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
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Consultas Aguardando Registro
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {pendingAppointments.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => startRecordFromAppointment(apt)}
                  className="p-2 border border-border rounded-md cursor-pointer hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-foreground">{apt.patient?.name}</p>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
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
      {printDialogSnapshot && (
        <PrintDialog
          open={printDialogOpen}
          onOpenChange={(open) => {
            setPrintDialogOpen(open);
            if (!open) setPrintDialogSnapshot(null);
          }}
          clinic={printDialogSnapshot.clinic}
          clinicId={printDialogSnapshot.clinicId}
          patient={printDialogSnapshot.patient}
          patientId={printDialogSnapshot.patientId}
          professional={printDialogSnapshot.professional}
          professionalId={printDialogSnapshot.professionalId}
          medicalRecordId={printDialogSnapshot.medicalRecordId}
          initialPrescription={printDialogSnapshot.initialPrescription}
          date={printDialogSnapshot.date}
          onDocumentSaved={() => {
            // Avoid closing/unmount-related state issues when switching tabs.
            if (selectedPatient && currentClinic) {
              fetchPatientDocuments();
            }
          }}
        />
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUpload={handleUpload}
        folders={folders}
        currentFolderId={selectedFolderId}
        onCreateFolder={createFolder}
      />

      {/* File Preview Modal */}
      {previewAttachment && (
        <FilePreviewModal
          attachment={previewAttachment}
          open={!!previewAttachment}
          onOpenChange={(open) => !open && setPreviewAttachment(null)}
          onGetUrl={getFileUrl}
          onDownload={handleDownloadAttachment}
        />
      )}

      {/* Access Logs Modal */}
      {logsAttachment && (
        <AccessLogsModal
          attachment={logsAttachment}
          open={!!logsAttachment}
          onOpenChange={(open) => !open && setLogsAttachment(null)}
          onFetchLogs={getAccessLogs}
        />
      )}
    </div>
  );
}
