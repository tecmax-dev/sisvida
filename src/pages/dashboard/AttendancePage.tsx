import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
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
  CloudOff,
  Cloud,
  Stethoscope,
  Timer,
  Lock,
  Send,
  Video,
  FlaskConical,
  Copy,
  ChevronDown,
  Printer,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TelemedicineButton } from "@/components/telemedicine/TelemedicineButton";
import { VideoCall } from "@/components/telemedicine/VideoCall";
import { sendWhatsAppDocument, sendWhatsAppMessage, formatTelemedicineInvite, formatExamRequest } from "@/lib/whatsapp";
import { generatePrescriptionPDF } from "@/lib/prescriptionExportUtils";
import { generateExamRequestPDF } from "@/lib/examRequestExportUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Odontogram } from "@/components/medical/Odontogram";
import { VitalSignsDisplay } from "@/components/appointments/VitalSignsDisplay";
import { PrintDialog } from "@/components/medical/PrintDialog";
import { MedicationSearch } from "@/components/medical/MedicationSearch";

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
  professional_id: string;
  clinic_id: string;
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

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
  telemedicine: "Telemedicina",
};

export default function AttendancePage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentClinic } = useAuth();
  
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loadingAppointment, setLoadingAppointment] = useState(true);
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
  const [examWhatsappPhone, setExamWhatsappPhone] = useState("");
  const [showExamWhatsAppDialog, setShowExamWhatsAppDialog] = useState(false);
  
  // Previous prescriptions state
  const [previousPrescriptions, setPreviousPrescriptions] = useState<Array<{
    id: string;
    content: string;
    created_at: string;
    professional_name?: string;
    is_controlled?: boolean;
  }>>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  
  // Print Dialog state
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printDialogInitialTab, setPrintDialogInitialTab] = useState<
    "receituario" | "controlado" | "atestado" | "comparecimento" | "exames"
  >("receituario");

  // Auto-save states for Prontuário/Receituário
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedFormRef = useRef<string>('');
  const isInitialLoadRef = useRef(true);
  
  // Auto-save states for Exames
  const [examAutoSaveStatus, setExamAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const examAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedExamRef = useRef<string>('');
  const isExamInitialLoadRef = useRef(true);
  // Load appointment
  useEffect(() => {
    if (!appointmentId || !currentClinic?.id) return;
    
    const loadAppointment = async () => {
      setLoadingAppointment(true);
      
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, patient_id, appointment_date, start_time, end_time,
          type, status, notes, started_at, completed_at, duration_minutes,
          procedure_id, professional_id, clinic_id,
          patient:patients(id, name, phone, email, birth_date),
          procedure:procedures(id, name, price)
        `)
        .eq("id", appointmentId)
        .eq("clinic_id", currentClinic.id)
        .maybeSingle();
      
      if (error || !data) {
        toast({
          title: "Agendamento não encontrado",
          variant: "destructive",
        });
        navigate("/dashboard/calendar");
        return;
      }
      
      setAppointment({
        ...data,
        patient: data.patient as Patient,
        procedure: data.procedure as Procedure | null,
      });
      setExamWhatsappPhone((data.patient as Patient)?.phone || "");
      setLoadingAppointment(false);
    };
    
    loadAppointment();
  }, [appointmentId, currentClinic?.id, navigate, toast]);

  const isCompleted = appointment?.status === "completed";
  const isInProgress = appointment?.status === "in_progress";
  const isTelemedicine = appointment?.type === "telemedicine";

  // Real-time timer
  useEffect(() => {
    if (!isInProgress || !appointment?.started_at) return;

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
  }, [isInProgress, appointment?.started_at]);

  // Load patient data
  useEffect(() => {
    if (appointment) {
      loadPatientData();
    }
  }, [appointment?.patient_id]);

  const loadPatientData = async () => {
    if (!appointment) return;
    
    setLoadingData(true);
    
    try {
      // Load clinic data
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("name, address, phone, cnpj")
        .eq("id", appointment.clinic_id)
        .maybeSingle();

      if (clinicData) {
        setClinic(clinicData);
      }

      // Load professional data
      const { data: profData } = await supabase
        .from("professionals")
        .select("name, specialty, registration_number")
        .eq("id", appointment.professional_id)
        .maybeSingle();

      if (profData) {
        setProfessional(profData);
      }

      // Check if professional has dental specialty
      const { data: profSpecialties } = await supabase
        .from('professional_specialties')
        .select('specialty:specialties(is_dental, category)')
        .eq('professional_id', appointment.professional_id);

      const hasDentalFromDB = (profSpecialties || []).some((ps: any) => 
        ps.specialty?.is_dental === true || ps.specialty?.category === 'dental'
      );
      setIsDentalSpecialty(hasDentalFromDB);

      // Load anamnesis
      const { data: anamnesisData } = await supabase
        .from("anamnesis")
        .select("*")
        .eq("patient_id", appointment.patient_id)
        .eq("clinic_id", appointment.clinic_id)
        .order("filled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anamnesisData) {
        setAnamnesis(anamnesisData);
      }

      // Load medical history
      const { data: historyData } = await supabase
        .from("medical_records")
        .select(`
          id, record_date, chief_complaint, diagnosis, treatment_plan,
          prescription, notes, created_at,
          professional:professionals(id, name)
        `)
        .eq("patient_id", appointment.patient_id)
        .eq("clinic_id", appointment.clinic_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (historyData) {
        setMedicalHistory(historyData as MedicalRecord[]);
      }

      // Load existing record for this appointment
      const { data: recordData } = await supabase
        .from("medical_records")
        .select("chief_complaint, diagnosis, treatment_plan, prescription, notes")
        .eq("appointment_id", appointment.id)
        .maybeSingle();

      if (recordData) {
        setRecordForm({
          chief_complaint: recordData.chief_complaint || "",
          diagnosis: recordData.diagnosis || "",
          treatment_plan: recordData.treatment_plan || "",
          prescription: recordData.prescription || "",
          notes: recordData.notes || "",
        });
      }

      // Load existing exam request for this appointment
      const { data: examData } = await supabase
        .from("medical_documents")
        .select("content, additional_info")
        .match({ appointment_id: appointment.id, document_type: "exam_request" })
        .maybeSingle();

      if (examData) {
        setExamRequest(examData.content || "");
        const additionalInfo = examData.additional_info as Record<string, string | null> | null;
        setClinicalIndication(additionalInfo?.clinical_indication || "");
        // Mark initial exam data as loaded
        lastSavedExamRef.current = JSON.stringify({ examRequest: examData.content || "", clinicalIndication: additionalInfo?.clinical_indication || "" });
      }
      
      await loadPreviousPrescriptions();
    } catch (error) {
      console.error("Error loading patient data:", error);
    } finally {
      setLoadingData(false);
      isInitialLoadRef.current = false;
      isExamInitialLoadRef.current = false;
    }
  };

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!appointment || isCompleted) return;
    
    const currentFormJson = JSON.stringify(recordForm);
    
    // Don't save if nothing changed
    if (currentFormJson === lastSavedFormRef.current) return;
    
    // Don't save if form is completely empty
    const hasContent = recordForm.chief_complaint || recordForm.diagnosis || 
                       recordForm.treatment_plan || recordForm.prescription || recordForm.notes;
    if (!hasContent) return;
    
    setAutoSaveStatus('saving');
    
    try {
      const { error } = await supabase
        .from("medical_records")
        .upsert({
          clinic_id: appointment.clinic_id,
          patient_id: appointment.patient_id,
          professional_id: appointment.professional_id,
          appointment_id: appointment.id,
          record_date: new Date().toISOString().split("T")[0],
          chief_complaint: recordForm.chief_complaint || null,
          diagnosis: recordForm.diagnosis || null,
          treatment_plan: recordForm.treatment_plan || null,
          prescription: recordForm.prescription || null,
          notes: recordForm.notes || null,
        }, { onConflict: 'appointment_id', ignoreDuplicates: false });

      if (error) {
        setAutoSaveStatus('error');
        console.error("Auto-save error:", error);
      } else {
        lastSavedFormRef.current = currentFormJson;
        setAutoSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
    } catch (error) {
      setAutoSaveStatus('error');
      console.error("Auto-save error:", error);
    }
  }, [appointment, recordForm, isCompleted]);

  // Auto-save effect - triggers 3 seconds after last change
  useEffect(() => {
    // Skip auto-save during initial load
    if (isInitialLoadRef.current || isCompleted) return;
    
    // Clear previous timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 3000);
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [recordForm, performAutoSave, isCompleted]);

  // Exam auto-save function
  const performExamAutoSave = useCallback(async () => {
    if (!appointment || isCompleted) return;
    
    const currentExamJson = JSON.stringify({ examRequest, clinicalIndication });
    
    // Don't save if nothing changed
    if (currentExamJson === lastSavedExamRef.current) return;
    
    // Don't save if form is completely empty
    if (!examRequest.trim() && !clinicalIndication.trim()) return;
    
    setExamAutoSaveStatus('saving');
    
    try {
      const { error } = await supabase
        .from("medical_documents")
        .upsert({
          clinic_id: appointment.clinic_id,
          patient_id: appointment.patient_id,
          professional_id: appointment.professional_id,
          appointment_id: appointment.id,
          document_type: "exam_request",
          content: examRequest || null,
          additional_info: { clinical_indication: clinicalIndication || null },
          document_date: new Date().toISOString().split("T")[0],
        }, { onConflict: 'appointment_id,document_type', ignoreDuplicates: false });

      if (error) {
        setExamAutoSaveStatus('error');
        console.error("Exam auto-save error:", error);
      } else {
        lastSavedExamRef.current = currentExamJson;
        setExamAutoSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => setExamAutoSaveStatus('idle'), 2000);
      }
    } catch (error) {
      setExamAutoSaveStatus('error');
      console.error("Exam auto-save error:", error);
    }
  }, [appointment, examRequest, clinicalIndication, isCompleted]);

  // Exam auto-save effect - triggers 3 seconds after last change
  useEffect(() => {
    // Skip auto-save during initial load
    if (isExamInitialLoadRef.current || isCompleted) return;
    
    // Clear previous timeout
    if (examAutoSaveTimeoutRef.current) {
      clearTimeout(examAutoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    examAutoSaveTimeoutRef.current = setTimeout(() => {
      performExamAutoSave();
    }, 3000);
    
    return () => {
      if (examAutoSaveTimeoutRef.current) {
        clearTimeout(examAutoSaveTimeoutRef.current);
      }
    };
  }, [examRequest, clinicalIndication, performExamAutoSave, isCompleted]);

  const loadPreviousPrescriptions = async () => {
    if (!appointment) return;
    
    setLoadingPrescriptions(true);
    try {
      const { data: prescriptionsData } = await supabase
        .from("prescriptions")
        .select(`id, content, created_at, professional:professionals(name)`)
        .eq("clinic_id", appointment.clinic_id)
        .eq("patient_id", appointment.patient_id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: recordsData } = await supabase
        .from("medical_records")
        .select(`id, prescription, created_at, professional:professionals(name)`)
        .eq("clinic_id", appointment.clinic_id)
        .eq("patient_id", appointment.patient_id)
        .not("prescription", "is", null)
        .neq("prescription", "")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: controlledData } = await supabase
        .from("medical_documents")
        .select(`id, content, created_at, professional:professionals(name)`)
        .eq("clinic_id", appointment.clinic_id)
        .eq("patient_id", appointment.patient_id)
        .eq("document_type", "controlled_prescription")
        .not("content", "is", null)
        .neq("content", "")
        .order("created_at", { ascending: false })
        .limit(10);

      const allPrescriptions: Array<{
        id: string;
        content: string;
        created_at: string;
        professional_name?: string;
        is_controlled?: boolean;
      }> = [];

      if (prescriptionsData) {
        prescriptionsData.forEach((p: any) => {
          allPrescriptions.push({
            id: `prescription-${p.id}`,
            content: p.content,
            created_at: p.created_at,
            professional_name: p.professional?.name,
            is_controlled: false,
          });
        });
      }

      if (recordsData) {
        recordsData.forEach((r: any) => {
          if (r.prescription) {
            allPrescriptions.push({
              id: `record-${r.id}`,
              content: r.prescription,
              created_at: r.created_at,
              professional_name: r.professional?.name,
              is_controlled: false,
            });
          }
        });
      }

      if (controlledData) {
        controlledData.forEach((c: any) => {
          if (c.content) {
            allPrescriptions.push({
              id: `controlled-${c.id}`,
              content: c.content,
              created_at: c.created_at,
              professional_name: c.professional?.name,
              is_controlled: true,
            });
          }
        });
      }

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
    setRecordForm(prev => ({ ...prev, prescription: content }));
    toast({ title: "Prescrição copiada!", description: "O conteúdo foi aplicado ao receituário atual." });
  };

  const handleStartAppointment = async () => {
    if (!appointment) return;
    
    setLoading(true);
    
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", appointment.id);

    if (error) {
      toast({ title: "Erro ao iniciar atendimento", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Atendimento iniciado", description: "Bom atendimento!" });
      setAppointment({ ...appointment, status: "in_progress", started_at: new Date().toISOString() });
    }
    
    setLoading(false);
  };

  const handleEndAppointment = async () => {
    if (!appointment) return;
    
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
      toast({ title: "Erro ao finalizar atendimento", description: error.message, variant: "destructive" });
    } else {
      // Create financial transaction if procedure is linked
      if (appointment.procedure_id && appointment.procedure) {
        await supabase.from("financial_transactions").insert({
          clinic_id: appointment.clinic_id,
          type: "income",
          description: `${appointment.procedure.name} - ${appointment.patient.name}`,
          amount: appointment.procedure.price,
          patient_id: appointment.patient_id,
          procedure_id: appointment.procedure_id,
          appointment_id: appointment.id,
          professional_id: appointment.professional_id,
          status: "pending",
          due_date: new Date().toISOString().split("T")[0],
        });
      }

      toast({ title: "Atendimento finalizado", description: `Duração: ${durationMinutes} minutos` });
      navigate("/dashboard/calendar");
    }
    
    setLoading(false);
  };

  const handleSaveRecord = async () => {
    if (!appointment) return;
    
    setSavingRecord(true);
    
    const { error } = await supabase
      .from("medical_records")
      .upsert({
        clinic_id: appointment.clinic_id,
        patient_id: appointment.patient_id,
        professional_id: appointment.professional_id,
        appointment_id: appointment.id,
        record_date: new Date().toISOString().split("T")[0],
        chief_complaint: recordForm.chief_complaint || null,
        diagnosis: recordForm.diagnosis || null,
        treatment_plan: recordForm.treatment_plan || null,
        prescription: recordForm.prescription || null,
        notes: recordForm.notes || null,
      }, { onConflict: 'appointment_id', ignoreDuplicates: false });

    if (error) {
      toast({ title: "Erro ao salvar prontuário", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Prontuário salvo", description: "Registro médico salvo com sucesso!" });
      loadPatientData();
    }
    
    setSavingRecord(false);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const handleSendPrescriptionWhatsApp = async () => {
    if (!appointment || !recordForm.prescription?.trim() || !appointment.patient.phone) return;

    setSendingWhatsApp(true);
    
    try {
      const { base64, fileName } = await generatePrescriptionPDF({
        clinic: { name: clinic?.name || "Clínica", address: clinic?.address, phone: clinic?.phone, cnpj: clinic?.cnpj },
        patient: { name: appointment.patient.name, birth_date: appointment.patient.birth_date },
        professional: professional ? { name: professional.name, specialty: professional.specialty, registration_number: professional.registration_number } : undefined,
        prescription: { content: recordForm.prescription, created_at: new Date().toISOString(), signature_data: null, is_signed: false },
      });

      const result = await sendWhatsAppDocument({
        phone: appointment.patient.phone,
        clinicId: appointment.clinic_id,
        pdfBase64: base64,
        fileName,
        caption: `📋 *Receituário Médico*\n\nOlá ${appointment.patient.name}!\n\nSegue em anexo seu receituário.\n\n📅 *Data:* ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}\n👨‍⚕️ *Profissional:* ${professional?.name || 'Profissional'}\n🏥 *Clínica:* ${clinic?.name || 'Clínica'}\n\nAtenciosamente,\nEquipe ${clinic?.name || 'Clínica'}`,
      });

      if (result.success) {
        toast({ title: "Receituário enviado!", description: `PDF enviado via WhatsApp para ${appointment.patient.phone}` });
      } else {
        throw new Error(result.error || "Erro ao enviar");
      }
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleSaveExamRequest = async () => {
    if (!appointment || !examRequest.trim()) return;
    
    try {
      await supabase.from("medical_documents").insert({
        clinic_id: appointment.clinic_id,
        patient_id: appointment.patient_id,
        professional_id: appointment.professional_id,
        document_type: "exam_request",
        content: examRequest,
        additional_info: { clinical_indication: clinicalIndication || null },
        document_date: new Date().toISOString().split("T")[0],
      });

      toast({ title: "Solicitação salva!", description: "Exames registrados no prontuário do paciente." });
      setExamRequest("");
      setClinicalIndication("");
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const handleSendExamRequestWhatsApp = async () => {
    if (!appointment || !examRequest.trim() || !examWhatsappPhone) return;
    
    setSendingExamRequest(true);
    
    try {
      const { base64, fileName } = await generateExamRequestPDF({
        clinic: { name: clinic?.name || "Clínica", address: clinic?.address, phone: clinic?.phone, cnpj: clinic?.cnpj },
        patient: { name: appointment.patient.name },
        professional: professional ? { name: professional.name, specialty: professional.specialty, registration_number: professional.registration_number } : undefined,
        examRequest,
        clinicalIndication,
        date: new Date().toISOString().split("T")[0],
      });

      const result = await sendWhatsAppDocument({
        phone: examWhatsappPhone,
        clinicId: appointment.clinic_id,
        pdfBase64: base64,
        fileName,
        caption: formatExamRequest(appointment.patient.name, clinic?.name || "Clínica", format(new Date(), "dd/MM/yyyy", { locale: ptBR }), professional?.name || "Profissional"),
      });

      if (result.success) {
        await supabase.from("medical_documents").insert({
          clinic_id: appointment.clinic_id,
          patient_id: appointment.patient_id,
          professional_id: appointment.professional_id,
          document_type: "exam_request",
          content: examRequest,
          additional_info: { clinical_indication: clinicalIndication || null },
          document_date: new Date().toISOString().split("T")[0],
          sent_via_whatsapp: true,
          sent_at: new Date().toISOString(),
          sent_to_phone: examWhatsappPhone,
        });

        toast({ title: "Enviado com sucesso!", description: `Solicitação de exames enviada para ${examWhatsappPhone}` });
        setShowExamWhatsAppDialog(false);
        setExamRequest("");
        setClinicalIndication("");
      } else {
        throw new Error(result.error || "Erro ao enviar");
      }
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setSendingExamRequest(false);
    }
  };

  if (loadingAppointment || !appointment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/calendar")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Stethoscope className="h-6 w-6 text-primary" />
              Painel de Atendimento
              {isCompleted && (
                <Badge variant="secondary" className="ml-2">
                  <Lock className="h-3 w-3 mr-1" />
                  Finalizado
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              {typeLabels[appointment.type] || appointment.type} - {format(new Date(appointment.appointment_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} às {appointment.start_time.substring(0, 5)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isInProgress && !isCompleted && (
            <Button onClick={handleStartAppointment} disabled={loading} size="lg">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : isTelemedicine ? <Video className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isTelemedicine ? "Iniciar Teleconsulta" : "Iniciar Atendimento"}
            </Button>
          )}
          {isInProgress && (
            <Button onClick={handleEndAppointment} disabled={loading} size="lg" className="bg-success hover:bg-success/90">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Finalizar Atendimento
            </Button>
          )}
        </div>
      </div>

      {/* Patient Info & Timer */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
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
              <span className="text-xl font-semibold text-success">{formatDuration(appointment.duration_minutes)}</span>
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

      {/* Vital Signs */}
      <VitalSignsDisplay appointmentId={appointment.id} />

      {/* Main Content */}
      <Tabs defaultValue="prontuario" className="w-full">
        <TabsList className={`w-full grid ${isDentalSpecialty ? 'grid-cols-6' : 'grid-cols-5'} h-auto gap-2 bg-transparent p-0`}>
          <TabsTrigger 
            value="prontuario" 
            className="flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl border-2 border-transparent bg-blue-50 text-blue-700 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:border-blue-600 data-[state=active]:shadow-lg hover:bg-blue-100 transition-all duration-200"
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs font-medium">Prontuário</span>
          </TabsTrigger>
          {isDentalSpecialty && (
            <TabsTrigger 
              value="odontograma"
              className="flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl border-2 border-transparent bg-cyan-50 text-cyan-700 data-[state=active]:bg-cyan-500 data-[state=active]:text-white data-[state=active]:border-cyan-600 data-[state=active]:shadow-lg hover:bg-cyan-100 transition-all duration-200"
            >
              <Stethoscope className="h-5 w-5" />
              <span className="text-xs font-medium">Odontograma</span>
            </TabsTrigger>
          )}
          <TabsTrigger 
            value="anamnese"
            className="flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl border-2 border-transparent bg-amber-50 text-amber-700 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:border-amber-600 data-[state=active]:shadow-lg hover:bg-amber-100 transition-all duration-200"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs font-medium">Anamnese</span>
          </TabsTrigger>
          <TabsTrigger 
            value="historico"
            className="flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl border-2 border-transparent bg-emerald-50 text-emerald-700 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:border-emerald-600 data-[state=active]:shadow-lg hover:bg-emerald-100 transition-all duration-200"
          >
            <History className="h-5 w-5" />
            <span className="text-xs font-medium">Histórico</span>
          </TabsTrigger>
          <TabsTrigger 
            value="receituario"
            className="flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl border-2 border-transparent bg-purple-50 text-purple-700 data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:border-purple-600 data-[state=active]:shadow-lg hover:bg-purple-100 transition-all duration-200"
          >
            <Pill className="h-5 w-5" />
            <span className="text-xs font-medium">Receituário</span>
          </TabsTrigger>
          <TabsTrigger 
            value="exames"
            className="flex flex-col items-center gap-1.5 py-3 px-4 rounded-xl border-2 border-transparent bg-rose-50 text-rose-700 data-[state=active]:bg-rose-500 data-[state=active]:text-white data-[state=active]:border-rose-600 data-[state=active]:shadow-lg hover:bg-rose-100 transition-all duration-200"
          >
            <FlaskConical className="h-5 w-5" />
            <span className="text-xs font-medium">Exames</span>
          </TabsTrigger>
        </TabsList>

        {/* Prontuário Tab */}
        <TabsContent value="prontuario" className="mt-4 space-y-4">
          {/* Auto-save indicator */}
          <div className="flex items-center justify-end gap-2 text-sm">
            {autoSaveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Salvando automaticamente...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Cloud className="h-3.5 w-3.5" />
                Salvo automaticamente
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-destructive">
                <CloudOff className="h-3.5 w-3.5" />
                Erro ao salvar
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Queixa Principal</Label>
              <Textarea value={recordForm.chief_complaint} onChange={(e) => setRecordForm({ ...recordForm, chief_complaint: e.target.value })} placeholder="Descreva a queixa principal do paciente..." className="min-h-[100px]" disabled={isCompleted} />
            </div>
            <div>
              <Label>Diagnóstico</Label>
              <Textarea value={recordForm.diagnosis} onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })} placeholder="Diagnóstico..." className="min-h-[100px]" disabled={isCompleted} />
            </div>
            <div>
              <Label>Plano de Tratamento</Label>
              <Textarea value={recordForm.treatment_plan} onChange={(e) => setRecordForm({ ...recordForm, treatment_plan: e.target.value })} placeholder="Plano de tratamento..." className="min-h-[100px]" disabled={isCompleted} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={recordForm.notes} onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })} placeholder="Observações adicionais..." className="min-h-[100px]" disabled={isCompleted} />
            </div>
          </div>
          {!isCompleted && (
            <Button onClick={handleSaveRecord} disabled={savingRecord} variant="outline" className="w-full">
              {savingRecord ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Prontuário Manualmente
            </Button>
          )}
        </TabsContent>

        {/* Odontograma Tab */}
        {isDentalSpecialty && (
          <TabsContent value="odontograma" className="mt-4">
            <Odontogram patientId={appointment.patient_id} clinicId={appointment.clinic_id} professionalId={appointment.professional_id} appointmentId={appointment.id} readOnly={isCompleted} />
          </TabsContent>
        )}

        {/* Anamnese Tab */}
        <TabsContent value="anamnese" className="mt-4">
          {loadingData ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : anamnesis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Informações Gerais</CardTitle></CardHeader><CardContent className="text-sm space-y-2">{anamnesis.blood_type && <p><strong>Tipo Sanguíneo:</strong> {anamnesis.blood_type}</p>}<p><strong>Tabagismo:</strong> {anamnesis.smoking ? "Sim" : "Não"}</p><p><strong>Álcool:</strong> {anamnesis.alcohol ? "Sim" : "Não"}</p><p><strong>Atividade Física:</strong> {anamnesis.physical_activity ? "Sim" : "Não"}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Alergias</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.allergies || "Nenhuma informada"}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Doenças Crônicas</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.chronic_diseases || "Nenhuma informada"}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Medicamentos em Uso</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.current_medications || "Nenhum informado"}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Cirurgias Anteriores</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.previous_surgeries || "Nenhuma informada"}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Histórico Familiar</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.family_history || "Nenhum informado"}</CardContent></Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground"><ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>Nenhuma anamnese registrada para este paciente</p></div>
          )}
        </TabsContent>

        {/* Histórico Tab */}
        <TabsContent value="historico" className="mt-4">
          {loadingData ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : medicalHistory.length > 0 ? (
            <div className="space-y-3">
              {medicalHistory.map((record) => (
                <Card key={record.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{format(new Date(record.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      {record.professional?.name && <span className="text-sm text-muted-foreground">- {record.professional.name}</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    {record.chief_complaint && <p><strong>Queixa:</strong> {record.chief_complaint}</p>}
                    {record.diagnosis && <p><strong>Diagnóstico:</strong> {record.diagnosis}</p>}
                    {record.treatment_plan && <p><strong>Tratamento:</strong> {record.treatment_plan}</p>}
                    {record.prescription && <p><strong>Prescrição:</strong> {record.prescription}</p>}
                    {record.notes && <p><strong>Obs:</strong> {record.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground"><History className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>Nenhum histórico de atendimentos anteriores</p></div>
          )}
        </TabsContent>

        {/* Receituário Tab */}
        <TabsContent value="receituario" className="mt-4 space-y-4">
          {!isCompleted && previousPrescriptions.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Copy className="h-4 w-4" /><span>Copiar de prescrições anteriores</span></div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={loadingPrescriptions}>{loadingPrescriptions ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Selecionar<ChevronDown className="h-4 w-4 ml-1" /></>}</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel>Prescrições Anteriores</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {previousPrescriptions.map((prescription) => (
                      <DropdownMenuItem key={prescription.id} onClick={() => handleCopyPrescription(prescription.content)} className="flex flex-col items-start gap-1 cursor-pointer">
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-xs text-muted-foreground">{format(new Date(prescription.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                          {prescription.is_controlled && <Badge variant="outline" className="text-xs h-4 px-1 border-amber-500 text-amber-600 bg-amber-50">Controlada</Badge>}
                          {prescription.professional_name && <span className="text-xs text-muted-foreground">- {prescription.professional_name}</span>}
                        </div>
                        <span className="text-sm line-clamp-2 text-foreground">{prescription.content.substring(0, 100)}{prescription.content.length > 100 ? "..." : ""}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => { setPrintDialogInitialTab("controlado"); setPrintDialogOpen(true); }}><Pill className="h-4 w-4 mr-1" />Receita Controlada</Button>
              </div>
            </div>
          )}
          
          {!isCompleted && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <Label className="text-sm font-medium mb-2 block">Buscar Medicamentos</Label>
              <MedicationSearch onSelectMedication={(text) => { const current = recordForm.prescription || ""; setRecordForm({ ...recordForm, prescription: current ? `${current}\n\n${text}` : text }); }} disabled={isCompleted} />
            </div>
          )}
          
          <div>
            <Label>Prescrição Médica</Label>
            <Textarea value={recordForm.prescription} onChange={(e) => setRecordForm({ ...recordForm, prescription: e.target.value })} placeholder="Descreva a prescrição médica..." className="min-h-[200px]" disabled={isCompleted} />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {!isCompleted && (
              <Button onClick={handleSaveRecord} disabled={savingRecord} className="flex-1 min-w-[140px]">
                {savingRecord ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Receituário
              </Button>
            )}
            <Button variant={isCompleted ? "default" : "outline"} onClick={handleSendPrescriptionWhatsApp} disabled={sendingWhatsApp || !recordForm.prescription?.trim() || !appointment.patient.phone} className={isCompleted ? "flex-1 min-w-[140px]" : "min-w-[140px]"}>
              {sendingWhatsApp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar WhatsApp
            </Button>
            <Button variant="outline" onClick={() => { setPrintDialogInitialTab("receituario"); setPrintDialogOpen(true); }} className="min-w-[160px]">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Receituário
            </Button>
          </div>
        </TabsContent>

        {/* Exames Tab */}
        <TabsContent value="exames" className="mt-4 space-y-4">
          {/* Auto-save indicator for Exams */}
          <div className="flex items-center justify-end gap-2 text-sm">
            {examAutoSaveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Salvando automaticamente...
              </span>
            )}
            {examAutoSaveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Cloud className="h-3.5 w-3.5" />
                Salvo automaticamente
              </span>
            )}
            {examAutoSaveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-destructive">
                <CloudOff className="h-3.5 w-3.5" />
                Erro ao salvar
              </span>
            )}
          </div>
          
          <div>
            <Label>Exames Solicitados</Label>
            <Textarea value={examRequest} onChange={(e) => setExamRequest(e.target.value)} placeholder="1. Hemograma completo&#10;2. Glicemia de jejum&#10;3. Colesterol total..." className="min-h-[150px] font-mono" disabled={isCompleted} />
          </div>
          <div>
            <Label>Indicação Clínica (opcional)</Label>
            <Textarea value={clinicalIndication} onChange={(e) => setClinicalIndication(e.target.value)} placeholder="Descrição da indicação clínica..." className="min-h-[80px]" disabled={isCompleted} />
          </div>
          <div className="flex flex-wrap gap-2">
            {!isCompleted && (
              <Button onClick={handleSaveExamRequest} disabled={!examRequest.trim()} variant="outline" className="flex-1 min-w-[140px]">
                <Save className="h-4 w-4 mr-2" />
                Salvar Manualmente
              </Button>
            )}
            <Button onClick={() => setShowExamWhatsAppDialog(true)} disabled={!examRequest.trim() || isCompleted} variant={isCompleted ? "default" : "outline"} className="flex-1 min-w-[140px]">
              <Send className="h-4 w-4 mr-2" />
              Enviar WhatsApp
            </Button>
            <Button variant="outline" onClick={() => { setPrintDialogInitialTab("exames"); setPrintDialogOpen(true); }} className="min-w-[160px]">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Solicitação
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Exam WhatsApp Dialog */}
      <Dialog open={showExamWhatsAppDialog} onOpenChange={setShowExamWhatsAppDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar Solicitação de Exames</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Telefone</Label><Input value={examWhatsappPhone} onChange={(e) => setExamWhatsappPhone(e.target.value)} placeholder="(00) 00000-0000" /></div>
            <p className="text-sm text-muted-foreground">O PDF da solicitação será enviado via WhatsApp para o número informado.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExamWhatsAppDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendExamRequestWhatsApp} disabled={sendingExamRequest || !examWhatsappPhone}>
              {sendingExamRequest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      {clinic && (
        <PrintDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          clinic={{ name: clinic.name, address: clinic.address || undefined, phone: clinic.phone || undefined, cnpj: clinic.cnpj || undefined }}
          clinicId={appointment.clinic_id}
          patient={{ name: appointment.patient.name, phone: appointment.patient.phone }}
          patientId={appointment.patient_id}
          professional={professional ? { name: professional.name, specialty: professional.specialty || undefined, registration_number: professional.registration_number || undefined } : undefined}
          professionalId={appointment.professional_id}
          initialPrescription={recordForm.prescription || ""}
          initialTab={printDialogInitialTab}
          date={new Date().toISOString().split("T")[0]}
          onDocumentSaved={() => loadPatientData()}
          onPrescriptionChange={(newPrescription) => setRecordForm(prev => ({ ...prev, prescription: newPrescription }))}
        />
      )}
    </div>
  );
}
