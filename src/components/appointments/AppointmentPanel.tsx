import { useState, useEffect } from "react";
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
  Send,
  Video,
  FlaskConical,
  MessageCircle,
  Copy,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TelemedicineButton } from "@/components/telemedicine/TelemedicineButton";
import { VideoCall } from "@/components/telemedicine/VideoCall";
import { sendWhatsAppDocument, sendWhatsAppMessage, formatTelemedicineInvite, formatExamRequest } from "@/lib/whatsapp";
import { generatePrescriptionPDF } from "@/lib/prescriptionExportUtils";
import { generateExamRequestPDF } from "@/lib/examRequestExportUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Odontogram } from "@/components/medical/Odontogram";
import { VitalSignsDisplay } from "@/components/appointments/VitalSignsDisplay";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
}

interface Procedure {
  id: string;
  name: string;
  price: number;
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
  procedure?: Procedure | null;
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
  professional: {
    id: string;
    name: string;
  } | null;
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

interface Clinic {
  name: string;
  address?: string | null;
  phone?: string | null;
  cnpj?: string | null;
}

interface Professional {
  name: string;
  specialty?: string | null;
  registration_number?: string | null;
}

interface AppointmentPanelProps {
  appointment: Appointment;
  professionalId: string;
  clinicId: string;
  onClose: () => void;
  onUpdate: () => void;
  isOpen: boolean;
  professionalSpecialty?: string | null;
}

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
  telemedicine: "Telemedicina",
};

export function AppointmentPanel({
  appointment,
  professionalId,
  clinicId,
  onClose,
  onUpdate,
  isOpen,
  professionalSpecialty,
}: AppointmentPanelProps) {
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState<string>("00:00:00");
  const [loading, setLoading] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [medicalHistory, setMedicalHistory] = useState<MedicalRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isDentalSpecialty, setIsDentalSpecialty] = useState(false);
  const [recordForm, setRecordForm] = useState({
    chief_complaint: "",
    diagnosis: "",
    treatment_plan: "",
    prescription: "",
    notes: "",
  });
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  
  // Telemedicine states
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [telemedicineSession, setTelemedicineSession] = useState<{
    sessionId: string;
    roomId: string;
    patientToken?: string;
  } | null>(null);
  const [sendingTelemedicineLink, setSendingTelemedicineLink] = useState(false);

  // Exam request states
  const [examRequest, setExamRequest] = useState("");
  const [clinicalIndication, setClinicalIndication] = useState("");
  const [sendingExamRequest, setSendingExamRequest] = useState(false);
  const [examWhatsappPhone, setExamWhatsappPhone] = useState(appointment.patient.phone || "");
  const [showExamWhatsAppDialog, setShowExamWhatsAppDialog] = useState(false);
  
  // Previous prescriptions state
  const [previousPrescriptions, setPreviousPrescriptions] = useState<Array<{
    id: string;
    content: string;
    created_at: string;
    professional_name?: string;
  }>>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  
  const isCompleted = appointment.status === "completed";
  const isInProgress = appointment.status === "in_progress";
  const isTelemedicine = appointment.type === "telemedicine";

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

  // Listen for auth state changes (session expiry)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        toast({
          title: "Sessão encerrada",
          description: "Você foi desconectado. Por favor, faça login novamente.",
          variant: "destructive",
        });
        onClose();
      }
    });

    return () => subscription.unsubscribe();
  }, [onClose, toast]);

  // Load patient data
  useEffect(() => {
    if (isOpen) {
      loadPatientData();
    }
  }, [isOpen, appointment.patient_id]);

  const loadPatientData = async () => {
    setLoadingData(true);
    
    try {
      // Load clinic data
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("name, address, phone, cnpj")
        .eq("id", clinicId)
        .maybeSingle();

      if (clinicData) {
        setClinic(clinicData);
      }

      // Load professional data
      const { data: profData } = await supabase
        .from("professionals")
        .select("name, specialty, registration_number")
        .eq("id", professionalId)
        .maybeSingle();

      if (profData) {
        setProfessional(profData);
      }

      // Check if professional has any dental specialty
      const { data: profSpecialties, error: specError } = await supabase
        .from('professional_specialties')
        .select('specialty:specialties(is_dental, category)')
        .eq('professional_id', professionalId);

      if (specError) {
        console.error('[ERROR Odontogram] Failed to check dental specialty:', specError);
      }

      // Check is_dental flag OR category === 'dental'
      const hasDentalFromDB = (profSpecialties || []).some((ps: any) => 
        ps.specialty?.is_dental === true || ps.specialty?.category === 'dental'
      );
      
      // Fallback: check professionalSpecialty prop for dental keywords
      const dentalKeywords = ['dental', 'odonto', 'dentist', 'ortodont', 'endodont', 'periodont', 'implant'];
      const hasDentalFromProp = professionalSpecialty && dentalKeywords.some(keyword => 
        professionalSpecialty.toLowerCase().includes(keyword)
      );
      
      const hasDental = hasDentalFromDB || !!hasDentalFromProp;
      setIsDentalSpecialty(hasDental);

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

      // Load medical history with professional data
      const { data: historyData } = await supabase
        .from("medical_records")
        .select(`
          id,
          record_date,
          chief_complaint,
          diagnosis,
          treatment_plan,
          prescription,
          notes,
          created_at,
          professional:professionals(id, name)
        `)
        .eq("patient_id", appointment.patient_id)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (historyData) {
        setMedicalHistory(historyData as MedicalRecord[]);
      }

      // Load prescription from this appointment if completed
      if (isCompleted) {
        const { data: recordData } = await supabase
          .from("medical_records")
          .select("prescription")
          .eq("appointment_id", appointment.id)
          .maybeSingle();

        if (recordData?.prescription) {
          setRecordForm(prev => ({
            ...prev,
            prescription: recordData.prescription || "",
          }));
        }
      }
      
      // Load previous prescriptions for this patient
      await loadPreviousPrescriptions();
    } catch (error) {
      console.error("Error loading patient data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadPreviousPrescriptions = async () => {
    setLoadingPrescriptions(true);
    try {
      // Get from prescriptions table
      const { data: prescriptionsData } = await supabase
        .from("prescriptions")
        .select(`
          id,
          content,
          created_at,
          professional:professionals(name)
        `)
        .eq("clinic_id", clinicId)
        .eq("patient_id", appointment.patient_id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Also get from medical_records that have prescription
      const { data: recordsData } = await supabase
        .from("medical_records")
        .select(`
          id,
          prescription,
          created_at,
          professional:professionals(name)
        `)
        .eq("clinic_id", clinicId)
        .eq("patient_id", appointment.patient_id)
        .not("prescription", "is", null)
        .neq("prescription", "")
        .order("created_at", { ascending: false })
        .limit(10);

      const allPrescriptions: Array<{
        id: string;
        content: string;
        created_at: string;
        professional_name?: string;
      }> = [];

      // Add from prescriptions table
      if (prescriptionsData) {
        prescriptionsData.forEach((p: any) => {
          allPrescriptions.push({
            id: `prescription-${p.id}`,
            content: p.content,
            created_at: p.created_at,
            professional_name: p.professional?.name,
          });
        });
      }

      // Add from medical_records
      if (recordsData) {
        recordsData.forEach((r: any) => {
          if (r.prescription) {
            allPrescriptions.push({
              id: `record-${r.id}`,
              content: r.prescription,
              created_at: r.created_at,
              professional_name: r.professional?.name,
            });
          }
        });
      }

      // Sort by date and remove duplicates by content
      const sortedUnique = allPrescriptions
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter((item, index, self) => 
          index === self.findIndex((t) => t.content.trim() === item.content.trim())
        );

      setPreviousPrescriptions(sortedUnique);
    } catch (error) {
      console.error("Error loading previous prescriptions:", error);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  const handleCopyPrescription = (content: string) => {
    setRecordForm(prev => ({
      ...prev,
      prescription: content,
    }));
    toast({
      title: "Prescrição copiada!",
      description: "O conteúdo foi aplicado ao receituário atual.",
    });
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
      // Create financial transaction if procedure is linked
      if (appointment.procedure_id && appointment.procedure) {
        const { error: transactionError } = await supabase
          .from("financial_transactions")
          .insert({
            clinic_id: clinicId,
            type: "income",
            description: `${appointment.procedure.name} - ${appointment.patient.name}`,
            amount: appointment.procedure.price,
            patient_id: appointment.patient_id,
            procedure_id: appointment.procedure_id,
            appointment_id: appointment.id,
            professional_id: professionalId,
            status: "pending",
            due_date: new Date().toISOString().split("T")[0],
          });

        if (transactionError) {
          console.error("Error creating transaction:", transactionError);
        }
      }

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

  const handleSendPrescriptionWhatsApp = async () => {
    const prescriptionContent = recordForm.prescription?.trim();
    
    if (!prescriptionContent) {
      toast({
        title: "Erro",
        description: "Não há prescrição para enviar.",
        variant: "destructive",
      });
      return;
    }

    if (!appointment.patient.phone) {
      toast({
        title: "Erro",
        description: "Paciente sem telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }

    setSendingWhatsApp(true);
    
    try {
      const { base64, fileName } = await generatePrescriptionPDF({
        clinic: {
          name: clinic?.name || "Clínica",
          address: clinic?.address,
          phone: clinic?.phone,
          cnpj: clinic?.cnpj,
        },
        patient: {
          name: appointment.patient.name,
          birth_date: appointment.patient.birth_date,
        },
        professional: professional ? {
          name: professional.name,
          specialty: professional.specialty,
          registration_number: professional.registration_number,
        } : undefined,
        prescription: {
          content: prescriptionContent,
          created_at: new Date().toISOString(),
          signature_data: null,
          is_signed: false,
        },
      });

      const result = await sendWhatsAppDocument({
        phone: appointment.patient.phone,
        clinicId: clinicId,
        pdfBase64: base64,
        fileName,
        caption: [
          `📋 *Receituário Médico*`,
          ``,
          `Olá ${appointment.patient.name}! 👋`,
          ``,
          `Segue em anexo seu receituário.`,
          ``,
          `📅 *Data:* ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`,
          `👨‍⚕️ *Profissional:* ${professional?.name || 'Profissional'}`,
          `🏥 *Clínica:* ${clinic?.name || 'Clínica'}`,
          ``,
          `⚠️ *Atenção:* Siga as orientações do profissional de saúde. Em caso de dúvidas, entre em contato conosco.`,
          ``,
          `Atenciosamente,`,
          `Equipe ${clinic?.name || 'Clínica'}`,
        ].join('\n'),
      });

      if (result.success) {
        toast({
          title: "Receituário enviado!",
          description: `PDF enviado via WhatsApp para ${appointment.patient.phone}`,
        });
      } else {
        throw new Error(result.error || "Erro ao enviar");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleSendTelemedicineLink = async () => {
    if (!telemedicineSession?.patientToken) {
      toast({
        title: "Erro",
        description: "Sessão de telemedicina não encontrada. Inicie a teleconsulta primeiro.",
        variant: "destructive",
      });
      return;
    }

    if (!appointment.patient.phone) {
      toast({
        title: "Erro",
        description: "Paciente sem telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }

    setSendingTelemedicineLink(true);

    try {
      const telemedicineLink = `${window.location.origin}/telemedicina/${telemedicineSession.patientToken}`;
      
      const message = formatTelemedicineInvite(
        appointment.patient.name,
        clinic?.name || "Clínica",
        format(new Date(appointment.appointment_date), "dd/MM/yyyy", { locale: ptBR }),
        appointment.start_time.substring(0, 5),
        professional?.name || "Profissional",
        telemedicineLink
      );

      const result = await sendWhatsAppMessage({
        phone: appointment.patient.phone,
        message,
        clinicId,
        type: "custom",
      });

      if (result.success) {
        toast({
          title: "Link enviado!",
          description: `Link da teleconsulta enviado para ${appointment.patient.phone}`,
        });
      } else {
        throw new Error(result.error || "Erro ao enviar");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingTelemedicineLink(false);
    }
  };

  const handleSaveExamRequest = async () => {
    if (!examRequest.trim()) return;
    
    try {
      await supabase.from("medical_documents").insert({
        clinic_id: clinicId,
        patient_id: appointment.patient_id,
        professional_id: professionalId,
        document_type: "exam_request",
        content: examRequest,
        additional_info: { clinical_indication: clinicalIndication || null },
        document_date: new Date().toISOString().split("T")[0],
      });

      toast({
        title: "Solicitação salva!",
        description: "Exames registrados no prontuário do paciente.",
      });
      
      setExamRequest("");
      setClinicalIndication("");
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendExamRequestWhatsApp = async () => {
    if (!examRequest.trim() || !examWhatsappPhone) return;
    
    setSendingExamRequest(true);
    
    try {
      const { base64, fileName } = await generateExamRequestPDF({
        clinic: {
          name: clinic?.name || "Clínica",
          address: clinic?.address,
          phone: clinic?.phone,
          cnpj: clinic?.cnpj,
        },
        patient: {
          name: appointment.patient.name,
        },
        professional: professional ? {
          name: professional.name,
          specialty: professional.specialty,
          registration_number: professional.registration_number,
        } : undefined,
        examRequest,
        clinicalIndication,
        date: new Date().toISOString().split("T")[0],
      });

      const result = await sendWhatsAppDocument({
        phone: examWhatsappPhone,
        clinicId,
        pdfBase64: base64,
        fileName,
        caption: formatExamRequest(
          appointment.patient.name,
          clinic?.name || "Clínica",
          format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
          professional?.name || "Profissional"
        ),
      });

      if (result.success) {
        await supabase.from("medical_documents").insert({
          clinic_id: clinicId,
          patient_id: appointment.patient_id,
          professional_id: professionalId,
          document_type: "exam_request",
          content: examRequest,
          additional_info: { clinical_indication: clinicalIndication || null },
          document_date: new Date().toISOString().split("T")[0],
          sent_via_whatsapp: true,
          sent_at: new Date().toISOString(),
          sent_to_phone: examWhatsappPhone,
        });

        toast({
          title: "Enviado com sucesso! 📋",
          description: `Solicitação de exames enviada para ${examWhatsappPhone}`,
        });
        
        setShowExamWhatsAppDialog(false);
        setExamRequest("");
        setClinicalIndication("");
      } else {
        throw new Error(result.error || "Erro ao enviar");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingExamRequest(false);
    }
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
                {new Date(appointment.appointment_date + "T12:00:00").toLocaleDateString("pt-BR")}
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
            <TabsList className={`w-full grid ${isDentalSpecialty ? 'grid-cols-6' : 'grid-cols-5'}`}>
              <TabsTrigger value="prontuario">
                <FileText className="h-4 w-4 mr-1.5" />
                Prontuário
              </TabsTrigger>
              {isDentalSpecialty && (
                <TabsTrigger value="odontograma">
                  <Stethoscope className="h-4 w-4 mr-1.5" />
                  Odontograma
                </TabsTrigger>
              )}
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
              <TabsTrigger value="exames">
                <FlaskConical className="h-4 w-4 mr-1.5" />
                Exames
              </TabsTrigger>
            </TabsList>

            {/* Vital Signs Display */}
            <VitalSignsDisplay appointmentId={appointment.id} className="mt-4" />

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

            {/* Odontograma Tab - Only for Dental Specialty */}
            {isDentalSpecialty && (
              <TabsContent value="odontograma" className="mt-4">
                <Odontogram
                  patientId={appointment.patient_id}
                  clinicId={clinicId}
                  professionalId={professionalId}
                  appointmentId={appointment.id}
                  readOnly={isCompleted}
                />
              </TabsContent>
            )}

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
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">
                            {format(new Date(record.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          {record.professional?.name && (
                            <span className="text-sm text-muted-foreground">
                              - {record.professional.name}
                            </span>
                          )}
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
            <TabsContent value="receituario" className="mt-4 space-y-4">
              {/* Copy from previous prescriptions */}
              {!isCompleted && previousPrescriptions.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Copy className="h-4 w-4" />
                    <span>Copiar de prescrições anteriores</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={loadingPrescriptions}>
                        {loadingPrescriptions ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Selecionar
                            <ChevronDown className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 max-h-[300px] overflow-y-auto">
                      <DropdownMenuLabel>Prescrições Anteriores</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {previousPrescriptions.map((prescription) => (
                        <DropdownMenuItem
                          key={prescription.id}
                          onClick={() => handleCopyPrescription(prescription.content)}
                          className="flex flex-col items-start gap-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(prescription.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            {prescription.professional_name && (
                              <span className="text-xs text-muted-foreground">
                                - {prescription.professional_name}
                              </span>
                            )}
                          </div>
                          <span className="text-sm line-clamp-2 text-foreground">
                            {prescription.content.substring(0, 100)}
                            {prescription.content.length > 100 ? "..." : ""}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              
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
              
              <div className="flex gap-2 mt-4">
                {!isCompleted && (
                  <Button 
                    onClick={handleSaveRecord} 
                    disabled={savingRecord}
                    className="flex-1"
                  >
                    {savingRecord ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Receituário
                  </Button>
                )}
                
                <Button 
                  variant={isCompleted ? "default" : "outline"}
                  onClick={handleSendPrescriptionWhatsApp}
                  disabled={sendingWhatsApp || !recordForm.prescription?.trim() || !appointment.patient.phone}
                  title={!appointment.patient.phone ? "Paciente sem telefone" : "Enviar via WhatsApp"}
                  className={isCompleted ? "flex-1" : ""}
                >
                  {sendingWhatsApp ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar WhatsApp
                </Button>
              </div>
              
              {isCompleted && recordForm.prescription && (
                <p className="text-sm text-muted-foreground mt-2">
                  O atendimento foi finalizado, mas você ainda pode enviar o receituário via WhatsApp.
                </p>
              )}
            </TabsContent>

            {/* Exames Tab */}
            <TabsContent value="exames" className="mt-4">
              <div className="space-y-4">
                <div>
                  <Label>Exames Solicitados</Label>
                  <Textarea
                    value={examRequest}
                    onChange={(e) => setExamRequest(e.target.value)}
                    placeholder="1. Hemograma completo&#10;2. Glicemia de jejum&#10;3. Colesterol total e frações&#10;..."
                    className="min-h-[150px] font-mono"
                    disabled={isCompleted}
                  />
                </div>
                
                <div>
                  <Label>Indicação Clínica (opcional)</Label>
                  <Input
                    value={clinicalIndication}
                    onChange={(e) => setClinicalIndication(e.target.value)}
                    placeholder="Ex: Investigação de diabetes"
                    disabled={isCompleted}
                  />
                </div>

                <div className="flex gap-2">
                  {!isCompleted && (
                    <Button 
                      onClick={handleSaveExamRequest} 
                      disabled={!examRequest.trim()}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Solicitação
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline"
                    className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => setShowExamWhatsAppDialog(true)}
                    disabled={!examRequest.trim()}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar WhatsApp
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        {/* Dialog para WhatsApp de Exames */}
        <Dialog open={showExamWhatsAppDialog} onOpenChange={setShowExamWhatsAppDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enviar Solicitação por WhatsApp</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Número do WhatsApp</Label>
                <Input
                  value={examWhatsappPhone}
                  onChange={(e) => setExamWhatsappPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {appointment.patient.phone 
                    ? "Telefone do paciente já preenchido."
                    : "Paciente sem telefone cadastrado."}
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowExamWhatsAppDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSendExamRequestWhatsApp}
                  disabled={!examWhatsappPhone || sendingExamRequest}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {sendingExamRequest ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Video Call Overlay */}
        {isVideoCallActive && telemedicineSession && (
          <div className="fixed inset-0 z-50 bg-background">
            <VideoCall
              sessionId={telemedicineSession.sessionId}
              roomId={telemedicineSession.roomId}
              isInitiator={true}
              patientName={appointment.patient.name}
              onEnd={() => {
                setIsVideoCallActive(false);
                setTelemedicineSession(null);
              }}
            />
          </div>
        )}

        {/* Footer Actions */}
        <Separator className="my-2" />
        <div className="flex justify-between gap-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <div className="flex gap-2">
            {/* Telemedicine Buttons */}
            {isTelemedicine && !isVideoCallActive && isInProgress && (
              <>
                <TelemedicineButton
                  appointmentId={appointment.id}
                  clinicId={clinicId}
                  onStartCall={(sessionId, roomId, patientToken) => {
                    setTelemedicineSession({ sessionId, roomId, patientToken });
                    setIsVideoCallActive(true);
                  }}
                  disabled={isCompleted}
                />
                
                {/* Send Link Button */}
                {telemedicineSession?.patientToken && (
                  <Button
                    variant="outline"
                    onClick={handleSendTelemedicineLink}
                    disabled={sendingTelemedicineLink || !appointment.patient.phone}
                    title={!appointment.patient.phone ? "Paciente sem telefone" : "Enviar link via WhatsApp"}
                  >
                    {sendingTelemedicineLink ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar Link
                  </Button>
                )}
              </>
            )}
            
            {!isInProgress && !isCompleted && (
              <Button onClick={handleStartAppointment} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isTelemedicine ? (
                  <Video className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isTelemedicine ? "Iniciar Teleconsulta" : "Iniciar Atendimento"}
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
