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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Play,
  Clock,
  CheckCircle2,
  User,
  UserX,
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
  ChevronLeft,
  ChevronRight,
  Printer,
  Eye,
  EyeOff,
  AlertCircle,
  Tag,
  Square,
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
import { format, differenceInYears, differenceInMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RealisticOdontogram } from "@/components/medical/RealisticOdontogram";
import { VitalSignsDisplay } from "@/components/appointments/VitalSignsDisplay";
import { PatientMedicalHistory } from "@/components/appointments/PatientMedicalHistory";
import { PrintDialog } from "@/components/medical/PrintDialog";
import { MedicationSearch } from "@/components/medical/MedicationSearch";
import { cn } from "@/lib/utils";

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

interface PatientStats {
  totalAppointments: number;
  firstVisit: string | null;
  missedAppointments: number;
}

const SIDEBAR_ITEMS = [
  { id: "resumo", label: "Resumo", icon: User, dentalOnly: false },
  { id: "exame-fisico", label: "Exame físico", icon: Stethoscope, dentalOnly: false },
  { id: "anamnese", label: "Anamnese", icon: ClipboardList, dentalOnly: false },
  { id: "odontograma", label: "Odontograma", icon: Stethoscope, dentalOnly: true },
  { id: "prontuario", label: "Prontuário", icon: FileText, dentalOnly: false },
  { id: "prescricoes", label: "Prescrições", icon: Pill, dentalOnly: false },
  { id: "exames", label: "Exames", icon: FlaskConical, dentalOnly: false },
  { id: "historico", label: "Histórico", icon: History, dentalOnly: false },
];

export default function AttendancePageRedesign() {
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
  const [activeSection, setActiveSection] = useState("resumo");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [patientStats, setPatientStats] = useState<PatientStats>({ totalAppointments: 0, firstVisit: null, missedAppointments: 0 });
  
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
  const [printDialogSnapshot, setPrintDialogSnapshot] = useState<{
    clinic: { name: string; address?: string; phone?: string; cnpj?: string };
    clinicId: string;
    patient: { name: string; phone: string };
    patientId: string;
    professional?: { name: string; specialty?: string; registration_number?: string };
    professionalId?: string;
    initialPrescription?: string;
    initialTab?: "receituario" | "controlado" | "atestado" | "comparecimento" | "exames";
    date: string;
  } | null>(null);
  const [printDialogInitialTab, setPrintDialogInitialTab] = useState<
    "receituario" | "controlado" | "atestado" | "comparecimento" | "exames"
  >("receituario");

  useEffect(() => {
    if (!printDialogOpen) return;
    if (!clinic || !appointment) return;

    setPrintDialogSnapshot({
      clinic: {
        name: clinic.name,
        address: clinic.address || undefined,
        phone: clinic.phone || undefined,
        cnpj: clinic.cnpj || undefined,
      },
      clinicId: appointment.clinic_id,
      patient: { name: appointment.patient.name, phone: appointment.patient.phone },
      patientId: appointment.patient_id,
      professional: professional
        ? {
            name: professional.name,
            specialty: professional.specialty || undefined,
            registration_number: professional.registration_number || undefined,
          }
        : undefined,
      professionalId: appointment.professional_id,
      initialPrescription: recordForm.prescription || "",
      initialTab: printDialogInitialTab,
      date: new Date().toISOString().split("T")[0],
    });
  }, [printDialogOpen, clinic, appointment, professional, recordForm.prescription, printDialogInitialTab]);

  // Auto-save states
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedFormRef = useRef<string>('');
  const isInitialLoadRef = useRef(true);
  
  // Exam auto-save states
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
      loadPatientStats();
    }
  }, [appointment?.patient_id]);

  const loadPatientStats = async () => {
    if (!appointment) return;
    
    try {
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, appointment_date, status")
        .eq("patient_id", appointment.patient_id)
        .eq("clinic_id", appointment.clinic_id)
        .order("appointment_date", { ascending: true });
      
      if (appointments && appointments.length > 0) {
        const missed = appointments.filter(a => a.status === "no_show").length;
        setPatientStats({
          totalAppointments: appointments.length,
          firstVisit: appointments[0].appointment_date,
          missedAppointments: missed,
        });
      }
    } catch (error) {
      console.error("Error loading patient stats:", error);
    }
  };

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
          professional:professionals(id, name),
          appointment:appointments(type, appointment_date)
        `)
        .eq("patient_id", appointment.patient_id)
        .eq("clinic_id", appointment.clinic_id)
        .order("record_date", { ascending: false })
        .order("created_at", { ascending: false });

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
    
    if (currentFormJson === lastSavedFormRef.current) return;
    
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
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }
    } catch (error) {
      setAutoSaveStatus('error');
      console.error("Auto-save error:", error);
    }
  }, [appointment, recordForm, isCompleted]);

  // Auto-save effect
  useEffect(() => {
    if (isInitialLoadRef.current || isCompleted) return;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
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

    if (currentExamJson === lastSavedExamRef.current) return;

    // content is NOT NULL in DB, so only autosave when examRequest has content
    if (!examRequest.trim()) return;

    setExamAutoSaveStatus('saving');

    try {
      // Check if document already exists for this appointment
      const { data: existing } = await supabase
        .from("medical_documents")
        .select("id")
        .eq("appointment_id", appointment.id)
        .eq("document_type", "exam_request")
        .maybeSingle();

      let error;
      if (existing?.id) {
        // Update existing
        const result = await supabase
          .from("medical_documents")
          .update({
            content: examRequest.trim(),
            additional_info: { clinical_indication: clinicalIndication || null },
            document_date: new Date().toISOString().split("T")[0],
          })
          .eq("id", existing.id);
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from("medical_documents")
          .insert({
            clinic_id: appointment.clinic_id,
            patient_id: appointment.patient_id,
            professional_id: appointment.professional_id,
            appointment_id: appointment.id,
            document_type: "exam_request",
            content: examRequest.trim(),
            additional_info: { clinical_indication: clinicalIndication || null },
            document_date: new Date().toISOString().split("T")[0],
          });
        error = result.error;
      }

      if (error) {
        setExamAutoSaveStatus('error');
        console.error("Exam auto-save error:", error);
      } else {
        lastSavedExamRef.current = currentExamJson;
        setExamAutoSaveStatus('saved');
        setTimeout(() => setExamAutoSaveStatus('idle'), 2000);
      }
    } catch (error) {
      setExamAutoSaveStatus('error');
      console.error("Exam auto-save error:", error);
    }
  }, [appointment, examRequest, clinicalIndication, isCompleted]);

  // Exam auto-save effect
  useEffect(() => {
    if (isExamInitialLoadRef.current || isCompleted) return;
    
    if (examAutoSaveTimeoutRef.current) {
      clearTimeout(examAutoSaveTimeoutRef.current);
    }
    
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

  const getPatientAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();
    const years = differenceInYears(now, birth);
    const months = differenceInMonths(now, birth) % 12;
    const days = differenceInDays(now, new Date(now.getFullYear(), now.getMonth() - months, birth.getDate()));
    
    return `${years} anos, ${months} meses, ${Math.abs(days)} dias`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
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

  const sidebarItems = SIDEBAR_ITEMS.filter(item => !item.dentalOnly || isDentalSpecialty);

  return (
    <div className="flex h-[calc(100vh-80px)] bg-gradient-to-br from-primary/5 via-background to-muted/40">
      {/* Left Sidebar */}
      <div className={cn(
        "bg-card border-r border-border flex flex-col transition-all duration-300",
        sidebarCollapsed ? "w-14" : "w-52"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <h2 className="font-semibold text-foreground">Prontuários</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Timer Section - Clean Style */}
        <div className="p-4 border-b border-border">
          {!sidebarCollapsed && (
            <p className="text-xs text-muted-foreground mb-3">Duração da consulta</p>
          )}
          
          <div className={cn(
            "flex items-center justify-center py-3 mb-4",
            sidebarCollapsed ? "px-1" : "px-4"
          )}>
            <div className="flex items-center gap-2">
              <Clock className={cn(
                "text-muted-foreground",
                sidebarCollapsed ? "h-4 w-4" : "h-5 w-5"
              )} />
              {!sidebarCollapsed && (
                <span className={cn(
                  "font-mono font-bold tracking-wider",
                  isInProgress ? "text-primary text-2xl" : 
                  isCompleted ? "text-accent text-xl" : 
                  "text-foreground text-2xl"
                )}>
                  {isInProgress ? elapsedTime : 
                   isCompleted && appointment.duration_minutes ? formatDuration(appointment.duration_minutes) : 
                   "00:00:00"}
                </span>
              )}
            </div>
          </div>

          {/* Action Button */}
          {!isInProgress && !isCompleted ? (
            <Button
              onClick={handleStartAppointment}
              disabled={loading}
              className={cn(
                "w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium",
                sidebarCollapsed ? "h-10 w-10 p-0" : ""
              )}
              size={sidebarCollapsed ? "icon" : "default"}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {!sidebarCollapsed && <span className="ml-2">Iniciar atendimento</span>}
                </>
              )}
            </Button>
          ) : isInProgress ? (
            <Button
              onClick={handleEndAppointment}
              disabled={loading}
              variant="destructive"
              className={cn(
                "w-full font-medium",
                sidebarCollapsed ? "h-10 w-10 p-0" : ""
              )}
              size={sidebarCollapsed ? "icon" : "default"}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Square className="h-4 w-4" />
                  {!sidebarCollapsed && <span className="ml-2">Finalizar</span>}
                </>
              )}
            </Button>
          ) : (
            <div className={cn(
              "flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-muted text-muted-foreground text-sm",
              sidebarCollapsed && "p-2"
            )}>
              <Lock className="h-4 w-4" />
              {!sidebarCollapsed && <span>Finalizado</span>}
            </div>
          )}
        </div>

        {/* Navigation - Clean Minimal Style */}
        <ScrollArea className="flex-1">
          <nav className="p-2">
            {sidebarItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <ScrollArea className="h-full">
          <div className="p-6">
            {/* Patient Summary Header - Always visible */}
            {activeSection === "resumo" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-semibold">Resumo do Paciente</h1>
                  <Button variant="outline" onClick={() => navigate(`/dashboard/patients/${appointment.patient_id}`)}>
                    Visualizar Cadastro
                  </Button>
                </div>

                {/* Patient Header Card - Enhanced Design */}
                <Card className="bg-gradient-to-r from-primary/5 via-background to-accent/5 border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-6">
                      <Avatar className="h-24 w-24 text-3xl ring-4 ring-primary/20 ring-offset-2 ring-offset-background">
                        <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                          {getInitials(appointment.patient.name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 space-y-4">
                        <div>
                          <h2 className="text-2xl font-bold text-foreground tracking-tight">
                            {appointment.patient.name.toUpperCase()}
                          </h2>
                          <p className="text-muted-foreground text-sm mt-1">
                            Paciente desde {patientStats.firstVisit ? format(new Date(patientStats.firstVisit + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "hoje"}
                          </p>
                        </div>

                        {/* Stats Cards Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {/* Age Card */}
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                              <Calendar className="h-4 w-4" />
                              <span className="text-xs font-medium uppercase tracking-wide">Idade</span>
                            </div>
                            <p className="text-lg font-bold text-foreground">
                              {getPatientAge(appointment.patient.birth_date) || "N/I"}
                            </p>
                          </div>

                          {/* Appointments Card */}
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                              <Stethoscope className="h-4 w-4" />
                              <span className="text-xs font-medium uppercase tracking-wide">Atendimentos</span>
                            </div>
                            <p className="text-lg font-bold text-foreground">
                              {patientStats.totalAppointments}
                            </p>
                          </div>

                          {/* No Show Card */}
                          <div className={cn(
                            "rounded-lg p-3 border",
                            patientStats.missedAppointments > 0 
                              ? "bg-red-500/10 border-red-500/20" 
                              : "bg-muted/50 border-border"
                          )}>
                            <div className={cn(
                              "flex items-center gap-2 mb-1",
                              patientStats.missedAppointments > 0 
                                ? "text-red-600 dark:text-red-400" 
                                : "text-muted-foreground"
                            )}>
                              <UserX className="h-4 w-4" />
                              <span className="text-xs font-medium uppercase tracking-wide">Faltas</span>
                            </div>
                            <p className={cn(
                              "text-lg font-bold",
                              patientStats.missedAppointments > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
                            )}>
                              {patientStats.missedAppointments}
                            </p>
                          </div>

                          {/* Blood Type or Phone Card */}
                          <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-1">
                              <Phone className="h-4 w-4" />
                              <span className="text-xs font-medium uppercase tracking-wide">Contato</span>
                            </div>
                            <p className="text-sm font-medium text-foreground truncate">
                              {appointment.patient.phone || "Não informado"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button variant="outline" size="sm" className="text-xs">
                            <Tag className="h-3.5 w-3.5 mr-1.5" />
                            Adicionar tag
                          </Button>
                          {appointment.patient.email && (
                            <Badge variant="secondary" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              {appointment.patient.email}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Vital Signs */}
                <VitalSignsDisplay appointmentId={appointment.id} />

                {/* Quick Anamnesis Summary - Enhanced */}
                {anamnesis && (
                  <Card className="border-amber-500/20">
                    <CardHeader className="pb-3 bg-amber-500/5 rounded-t-lg">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-600" />
                        Informações de Saúde
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {anamnesis.blood_type && (
                          <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium uppercase">Tipo Sanguíneo</span>
                            <p className="text-lg font-bold text-foreground mt-1">{anamnesis.blood_type}</p>
                          </div>
                        )}
                        {anamnesis.allergies && (
                          <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3">
                            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium uppercase">Alergias</span>
                            <p className="text-sm font-medium text-foreground mt-1 line-clamp-2">{anamnesis.allergies}</p>
                          </div>
                        )}
                        {anamnesis.chronic_diseases && (
                          <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium uppercase">Doenças Crônicas</span>
                            <p className="text-sm font-medium text-foreground mt-1 line-clamp-2">{anamnesis.chronic_diseases}</p>
                          </div>
                        )}
                        {anamnesis.current_medications && (
                          <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3">
                            <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium uppercase">Medicamentos</span>
                            <p className="text-sm font-medium text-foreground mt-1 line-clamp-2">{anamnesis.current_medications}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Odontogram Section */}
            {activeSection === "odontograma" && isDentalSpecialty && (
              <div className="space-y-6">
                <h1 className="text-xl font-semibold">Odontograma</h1>
                <RealisticOdontogram 
                  patientId={appointment.patient_id} 
                  clinicId={appointment.clinic_id} 
                  professionalId={appointment.professional_id} 
                  appointmentId={appointment.id} 
                  readOnly={isCompleted} 
                />
              </div>
            )}

            {/* Prontuário Section */}
            {activeSection === "prontuario" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-semibold">Prontuário</h1>
                  <div className="flex items-center gap-2 text-sm">
                    {autoSaveStatus === 'saving' && (
                      <span className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Salvando...
                      </span>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <Cloud className="h-3.5 w-3.5" />
                        Salvo
                      </span>
                    )}
                    {autoSaveStatus === 'error' && (
                      <span className="flex items-center gap-1.5 text-destructive">
                        <CloudOff className="h-3.5 w-3.5" />
                        Erro
                      </span>
                    )}
                  </div>
                </div>
                
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
                  <Button onClick={handleSaveRecord} disabled={savingRecord} variant="outline" className="w-full">
                    {savingRecord ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Prontuário Manualmente
                  </Button>
                )}
              </div>
            )}

            {/* Anamnese Section */}
            {activeSection === "anamnese" && (
              <div className="space-y-6">
                <h1 className="text-xl font-semibold">Anamnese</h1>
                {loadingData ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : anamnesis ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Informações Gerais</CardTitle></CardHeader>
                      <CardContent className="text-sm space-y-2">
                        {anamnesis.blood_type && <p><strong>Tipo Sanguíneo:</strong> {anamnesis.blood_type}</p>}
                        <p><strong>Tabagismo:</strong> {anamnesis.smoking ? "Sim" : "Não"}</p>
                        <p><strong>Álcool:</strong> {anamnesis.alcohol ? "Sim" : "Não"}</p>
                        <p><strong>Atividade Física:</strong> {anamnesis.physical_activity ? "Sim" : "Não"}</p>
                      </CardContent>
                    </Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Alergias</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.allergies || "Nenhuma informada"}</CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Doenças Crônicas</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.chronic_diseases || "Nenhuma informada"}</CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Medicamentos em Uso</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.current_medications || "Nenhum informado"}</CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Cirurgias Anteriores</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.previous_surgeries || "Nenhuma informada"}</CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Histórico Familiar</CardTitle></CardHeader><CardContent className="text-sm">{anamnesis.family_history || "Nenhum informado"}</CardContent></Card>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma anamnese registrada para este paciente</p>
                  </div>
                )}
              </div>
            )}

            {/* Histórico Section */}
            {activeSection === "historico" && (
              <div className="space-y-4">
                <h1 className="text-xl font-semibold">Histórico</h1>
                <PatientMedicalHistory 
                  records={medicalHistory} 
                  loading={loadingData}
                  patientName={appointment?.patient?.name}
                />
              </div>
            )}

            {/* Prescrições Section */}
            {activeSection === "prescricoes" && (
              <div className="space-y-6">
                <h1 className="text-xl font-semibold">Prescrições</h1>
                
                {!isCompleted && previousPrescriptions.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Copy className="h-4 w-4" />
                      <span>Copiar de prescrições anteriores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={loadingPrescriptions}>
                            {loadingPrescriptions ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Selecionar<ChevronDown className="h-4 w-4 ml-1" /></>}
                          </Button>
                        </DropdownMenuTrigger>
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
                      <Button variant="outline" size="sm" onClick={() => { setPrintDialogInitialTab("controlado"); setPrintDialogOpen(true); }}>
                        <Pill className="h-4 w-4 mr-1" />
                        Receita Controlada
                      </Button>
                    </div>
                  </div>
                )}
                
                {!isCompleted && (
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <Label className="text-sm font-medium mb-2 block">Buscar Medicamentos</Label>
                    <MedicationSearch 
                      onSelectMedication={(text) => { 
                        const current = recordForm.prescription || ""; 
                        setRecordForm({ ...recordForm, prescription: current ? `${current}\n\n${text}` : text }); 
                      }} 
                      disabled={isCompleted} 
                    />
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
                
                <div className="flex flex-wrap gap-2">
                  {!isCompleted && (
                    <Button onClick={handleSaveRecord} disabled={savingRecord} className="flex-1 min-w-[140px]">
                      {savingRecord ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar Receituário
                    </Button>
                  )}
                  <Button 
                    variant={isCompleted ? "default" : "outline"} 
                    onClick={handleSendPrescriptionWhatsApp} 
                    disabled={sendingWhatsApp || !recordForm.prescription?.trim() || !appointment.patient.phone} 
                    className={isCompleted ? "flex-1 min-w-[140px]" : "min-w-[140px]"}
                  >
                    {sendingWhatsApp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Enviar WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => { setPrintDialogInitialTab("receituario"); setPrintDialogOpen(true); }} className="min-w-[160px]">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Receituário
                  </Button>
                </div>
              </div>
            )}

            {/* Exames Section */}
            {activeSection === "exames" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-semibold">Exames</h1>
                  <div className="flex items-center gap-2 text-sm">
                    {examAutoSaveStatus === 'saving' && (
                      <span className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Salvando...
                      </span>
                    )}
                    {examAutoSaveStatus === 'saved' && (
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <Cloud className="h-3.5 w-3.5" />
                        Salvo
                      </span>
                    )}
                    {examAutoSaveStatus === 'error' && (
                      <span className="flex items-center gap-1.5 text-destructive">
                        <CloudOff className="h-3.5 w-3.5" />
                        Erro
                      </span>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label>Exames Solicitados</Label>
                  <Textarea 
                    value={examRequest} 
                    onChange={(e) => setExamRequest(e.target.value)} 
                    placeholder="1. Hemograma completo&#10;2. Glicemia de jejum&#10;3. Colesterol total..." 
                    className="min-h-[150px] font-mono" 
                    disabled={isCompleted} 
                  />
                </div>
                <div>
                  <Label>Indicação Clínica (opcional)</Label>
                  <Textarea 
                    value={clinicalIndication} 
                    onChange={(e) => setClinicalIndication(e.target.value)} 
                    placeholder="Descrição da indicação clínica..." 
                    className="min-h-[80px]" 
                    disabled={isCompleted} 
                  />
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
              </div>
            )}

            {/* Exame Físico Section */}
            {activeSection === "exame-fisico" && (
              <div className="space-y-6">
                <h1 className="text-xl font-semibold">Exame Físico</h1>
                <VitalSignsDisplay appointmentId={appointment.id} />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

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
          initialTab={printDialogSnapshot.initialTab}
          initialPrescription={printDialogSnapshot.initialPrescription}
          date={printDialogSnapshot.date}
        />
      )}
    </div>
  );
}
