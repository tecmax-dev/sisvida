import { useState, useRef, useEffect, useCallback } from "react";
import { Printer, FileText, Award, ClipboardCheck, Settings, FlaskConical, MessageCircle, Send, Loader2, Pill, Cloud, CloudOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CidSearch } from "./CidSearch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrescriptionPrint } from "./PrescriptionPrint";
import { MedicalCertificatePrint } from "./MedicalCertificatePrint";
import { AttendanceDeclarationPrint } from "./AttendanceDeclarationPrint";
import { ExamRequestPrint } from "./ExamRequestPrint";
import { ControlledPrescriptionPrint } from "./ControlledPrescriptionPrint";
import { DocumentSettingsDialog } from "./DocumentSettingsDialog";
import { useDocumentSettings } from "@/hooks/useDocumentSettings";
import { useToast } from "@/hooks/use-toast";
import { generateExamRequestPDF } from "@/lib/examRequestExportUtils";
import { sendWhatsAppDocument, formatExamRequest } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinic: {
    name: string;
    address?: string;
    phone?: string;
    cnpj?: string;
    logo_url?: string;
  };
  clinicId: string;
  patient: {
    name: string;
    phone?: string;
  };
  patientId: string;
  professional?: {
    name: string;
    specialty?: string;
    registration_number?: string;
  };
  professionalId?: string;
  medicalRecordId?: string;
  initialPrescription?: string;
  /** Which tab should be opened initially (defaults to 'receituario') */
  initialTab?: "receituario" | "controlado" | "atestado" | "comparecimento" | "exames";
  date: string;
  onDocumentSaved?: () => void;
  /** Callback to sync prescription changes with parent (for auto-save) */
  onPrescriptionChange?: (prescription: string) => void;
}

const getTabTitle = (tab: string) => {
  switch (tab) {
    case "receituario": return "Receituário";
    case "controlado": return "Receita Controlada";
    case "atestado": return "Atestado";
    case "comparecimento": return "Declaração de Comparecimento";
    case "exames": return "Solicitação de Exames";
    default: return "Documento";
  }
};

export function PrintDialog({
  open,
  onOpenChange,
  clinic,
  clinicId,
  patient,
  patientId,
  professional,
  professionalId,
  medicalRecordId,
  initialPrescription = "",
  initialTab = "receituario",
  date,
  onDocumentSaved,
  onPrescriptionChange,
}: PrintDialogProps) {
  const { settings } = useDocumentSettings(clinicId);
  const { toast } = useToast();
  const [prescription, setPrescription] = useState(initialPrescription);
  const [certificateDays, setCertificateDays] = useState(1);
  const [certificateReason, setCertificateReason] = useState("");
  const [attendanceStartTime, setAttendanceStartTime] = useState("08:00");
  const [attendanceEndTime, setAttendanceEndTime] = useState("09:00");
  const [activeTab, setActiveTab] = useState<"receituario" | "controlado" | "atestado" | "comparecimento" | "exames">(initialTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Auto-save states
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Exam request states
  const [examRequest, setExamRequest] = useState("");
  const [clinicalIndication, setClinicalIndication] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState(patient.phone || "");
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  
  const prescriptionRef = useRef<HTMLDivElement>(null);
  const controlledPrescriptionRef = useRef<HTMLDivElement>(null);
  const certificateRef = useRef<HTMLDivElement>(null);
  const attendanceRef = useRef<HTMLDivElement>(null);
  const examRequestRef = useRef<HTMLDivElement>(null);
  
  // Controlled prescription states
  const [controlledPrescription, setControlledPrescription] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  const [patientAddress, setPatientAddress] = useState("");

  const [patientDataLoading, setPatientDataLoading] = useState(false);
  const [patientDataError, setPatientDataError] = useState<string | null>(null);

  // Força re-busca ao reabrir o diálogo (mesmo paciente)
  const [fetchKey, setFetchKey] = useState(0);

  // Controle robusto de concorrência (evita "cancelled" + StrictMode)
  const patientFetchSeqRef = useRef(0);

  // Garante re-busca sempre que o usuário ENTRA na aba "controlado"
  const prevActiveTabRef = useRef<typeof activeTab>(initialTab);

  useEffect(() => {
    if (open) {
      setFetchKey((prev) => prev + 1);
      return;
    }

    // Invalida qualquer fetch pendente e limpa estado ao fechar
    patientFetchSeqRef.current += 1;
    setPatientCpf("");
    setPatientAddress("");
    setPatientDataError(null);
    setPatientDataLoading(false);
  }, [open]);

  useEffect(() => {
    const prev = prevActiveTabRef.current;
    prevActiveTabRef.current = activeTab;

    if (!open) return;
    if (activeTab !== "controlado") return;

    // Só incrementa quando realmente "entrou" na aba (não em cada render)
    if (prev !== "controlado") {
      setFetchKey((k) => k + 1);
    }
  }, [open, activeTab]);

  // Carrega CPF/Endereço quando a aba de Controlado estiver ativa
  useEffect(() => {
    if (!open) return;
    if (!patientId || !clinicId) return;
    if (activeTab !== "controlado") return;
    if (fetchKey === 0) return;

    const seq = ++patientFetchSeqRef.current;

    const fetchPatientData = async () => {
      try {
        setPatientDataError(null);
        setPatientDataLoading(true);

        const { data, error } = await supabase.functions.invoke(
          "get-patient-identification",
          {
            body: { clinicId, patientId },
          }
        );
        // Se apareceu uma requisição mais nova, ignore esta
        if (patientFetchSeqRef.current !== seq) return;

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || "Paciente não encontrado para esta clínica.");
        }

        const cpf = String(data.cpf || "").trim();
        const fullAddress = String(data.address || "").trim();

        if (!cpf && !fullAddress) {
          throw new Error(`CPF e endereço não estão cadastrados para o paciente ${patient?.name || "selecionado"}. Verifique o cadastro do paciente (ID: ${patientId}).`);
        }

        setPatientCpf(cpf);
        setPatientAddress(fullAddress);
      } catch (err) {
        if (patientFetchSeqRef.current !== seq) return;

        const message = err instanceof Error
          ? err.message
          : "Verifique permissões de acesso e tente novamente.";

        setPatientDataError(message);
        toast({
          title: "Não foi possível carregar os dados do paciente",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (patientFetchSeqRef.current === seq) setPatientDataLoading(false);
      }
    };

    fetchPatientData();

    // cleanup: invalida esta tentativa
    return () => {
      patientFetchSeqRef.current += 1;
    };
  }, [fetchKey, activeTab, patientId, clinicId, open, toast]);
  // Sync prescription state with initialPrescription when dialog opens
  useEffect(() => {
    if (open) {
      // Use initialPrescription if provided, otherwise fallback to template
      if (initialPrescription && initialPrescription.trim()) {
        setPrescription(initialPrescription);
      } else if (settings?.prescription_template) {
        setPrescription(settings.prescription_template);
      } else {
        setPrescription("");
      }
      setActiveTab(initialTab);
    }
  }, [open, initialPrescription, settings?.prescription_template, initialTab]);

  // Update whatsapp phone when patient changes
  useEffect(() => {
    setWhatsappPhone(patient.phone || "");
  }, [patient.phone]);

  // Auto-save prescription with debounce
  const performAutoSave = useCallback(async (content: string) => {
    if (!content.trim() || !onPrescriptionChange) return;
    
    setAutoSaveStatus('saving');
    try {
      onPrescriptionChange(content);
      setAutoSaveStatus('saved');
      // Reset status after 3 seconds
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Erro no auto-save:", error);
      setAutoSaveStatus('error');
    }
  }, [onPrescriptionChange]);

  // Handle prescription change with auto-save
  const handlePrescriptionChange = useCallback((value: string) => {
    setPrescription(value);
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new debounced auto-save
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave(value);
    }, 1500);
  }, [performAutoSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const getPrintContent = () => {
    switch (activeTab) {
      case "receituario": return prescriptionRef.current;
      case "controlado": return controlledPrescriptionRef.current;
      case "atestado": return certificateRef.current;
      case "comparecimento": return attendanceRef.current;
      case "exames": return examRequestRef.current;
      default: return null;
    }
  };

  // Save document to database
  const saveDocument = async (
    type: string, 
    content: string, 
    additionalInfo?: Record<string, unknown> | null,
    sentViaWhatsApp: boolean = false,
    sentToPhone?: string
  ) => {
    if (!clinicId || !patientId) return null;

    try {
      const { data, error } = await supabase
        .from('medical_documents')
        .insert([{
          clinic_id: clinicId,
          patient_id: patientId,
          professional_id: professionalId || null,
          medical_record_id: medicalRecordId || null,
          document_type: type,
          content,
          additional_info: additionalInfo ? JSON.parse(JSON.stringify(additionalInfo)) : null,
          document_date: date,
          sent_via_whatsapp: sentViaWhatsApp,
          sent_at: sentViaWhatsApp ? new Date().toISOString() : null,
          sent_to_phone: sentToPhone || null,
        }])
        .select()
        .single();

      if (error) throw error;

      onDocumentSaved?.();
      return data;
    } catch (error) {
      console.error("Erro ao salvar documento:", error);
      return null;
    }
  };

  // Get document content based on active tab
  const getDocumentContent = () => {
    switch (activeTab) {
      case "receituario": return prescription;
      case "controlado": return controlledPrescription;
      case "atestado": return `Afastamento de ${certificateDays} dia(s)` + (certificateReason ? ` - ${certificateReason}` : '');
      case "comparecimento": return `Comparecimento das ${attendanceStartTime} às ${attendanceEndTime}`;
      case "exames": return examRequest;
      default: return "";
    }
  };

  // Get additional info based on active tab
  const getAdditionalInfo = () => {
    switch (activeTab) {
      case "receituario": return { template_used: !!settings?.prescription_template };
      case "controlado": return { is_controlled: true, patient_cpf: patientCpf, patient_address: patientAddress };
      case "atestado": return { days: certificateDays, cid: certificateReason || null };
      case "comparecimento": return { start_time: attendanceStartTime, end_time: attendanceEndTime };
      case "exames": return { clinical_indication: clinicalIndication || null };
      default: return null;
    }
  };

  const handlePrint = async () => {
    const printContent = getPrintContent();
    
    if (!printContent) return;

    // Save document before printing
    const documentType = activeTab === "receituario" ? "prescription" 
      : activeTab === "controlado" ? "controlled_prescription"
      : activeTab === "atestado" ? "certificate"
      : activeTab === "comparecimento" ? "attendance"
      : "exam_request";
    
    await saveDocument(documentType, getDocumentContent(), getAdditionalInfo());

    const paperSize = settings?.paper_size || 'A4';
    const isA5 = paperSize === 'A5';
    const pageWidth = isA5 ? '148mm' : '210mm';
    const pageHeight = isA5 ? '210mm' : '297mm';

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${getTabTitle(activeTab)} - ${patient.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              size: ${paperSize};
              margin: 0;
            }
            @media print {
              body {
                width: ${pageWidth};
                min-height: ${pageHeight};
              }
            }
            .p-8 { padding: 2rem; }
            .bg-white { background-color: white; }
            .text-black { color: black; }
            .min-h-\\[297mm\\] { min-height: 297mm; }
            .w-\\[210mm\\] { width: 210mm; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            .border-b-2 { border-bottom: 2px solid; }
            .border-gray-300 { border-color: #d1d5db; }
            .border-gray-200 { border-color: #e5e7eb; }
            .border-black { border-color: black; }
            .border-t { border-top: 1px solid; }
            .pb-4 { padding-bottom: 1rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pt-4 { padding-top: 1rem; }
            .pt-8 { padding-top: 2rem; }
            .pl-4 { padding-left: 1rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-6 { margin-bottom: 1.5rem; }
            .mb-8 { margin-bottom: 2rem; }
            .mb-16 { margin-bottom: 4rem; }
            .my-12 { margin-top: 3rem; margin-bottom: 3rem; }
            .mt-8 { margin-top: 2rem; }
            .mt-32 { margin-top: 8rem; }
            .mt-auto { margin-top: auto; }
            .flex { display: flex; }
            .items-center { align-items: center; }
            .items-start { align-items: flex-start; }
            .justify-between { justify-content: space-between; }
            .gap-4 { gap: 1rem; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .text-justify { text-align: justify; }
            .text-xl { font-size: 1.25rem; }
            .text-2xl { font-size: 1.5rem; }
            .text-lg { font-size: 1.125rem; }
            .text-base { font-size: 1rem; }
            .text-sm { font-size: 0.875rem; }
            .text-xs { font-size: 0.75rem; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .text-gray-600 { color: #4b5563; }
            .text-gray-500 { color: #6b7280; }
            .text-gray-700 { color: #374151; }
            .text-primary { color: #0d9488; }
            .leading-relaxed { line-height: 1.625; }
            .leading-loose { line-height: 2; }
            .whitespace-pre-wrap { white-space: pre-wrap; }
            .min-h-\\[400px\\] { min-height: 400px; }
            .min-h-\\[200px\\] { min-height: 200px; }
            .w-64 { width: 16rem; }
            .h-16 { height: 4rem; }
            .object-contain { object-fit: contain; }
            strong { font-weight: bold; }
            h3 { font-size: 1.125rem; font-weight: 600; }
          </style>
        </head>
        <body>
          ${printContent.outerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    toast({
      title: "Documento salvo!",
      description: "O documento foi salvo no histórico do paciente.",
    });
  };

  const handleSendExamRequestWhatsApp = async () => {
    if (!whatsappPhone || !clinicId) return;
    
    setSendingWhatsApp(true);
    try {
      // Generate PDF
      const { base64, fileName } = await generateExamRequestPDF({
        clinic,
        patient,
        professional,
        examRequest,
        clinicalIndication,
        date,
      });
      
      // Format friendly message
      const formattedDate = new Date(date).toLocaleDateString('pt-BR');
      const message = formatExamRequest(
        patient.name,
        clinic.name,
        formattedDate,
        professional?.name || "Profissional"
      );
      
      // Send document via WhatsApp
      const result = await sendWhatsAppDocument({
        phone: whatsappPhone,
        clinicId,
        pdfBase64: base64,
        fileName,
        caption: message,
      });
      
      if (result.success) {
        // Save document with WhatsApp info
        await saveDocument(
          "exam_request",
          examRequest,
          { clinical_indication: clinicalIndication || null },
          true,
          whatsappPhone
        );

        toast({
          title: "Enviado com sucesso! 📋",
          description: `Solicitação de exames enviada para ${whatsappPhone}`,
        });
        setShowWhatsAppDialog(false);
      } else {
        throw new Error(result.error || "Erro ao enviar");
      }
    } catch (error: unknown) {
      console.error("Erro ao enviar solicitação por WhatsApp:", error);
      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : "Não foi possível enviar a solicitação de exames",
        variant: "destructive",
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Impressão de Documentos - {patient.name}
              </DialogTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="text-muted-foreground"
              >
                <Settings className="h-4 w-4 mr-1" />
                Configurar
              </Button>
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="receituario" className="flex items-center gap-1 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Receituário</span>
              </TabsTrigger>
              <TabsTrigger value="controlado" className="flex items-center gap-1 text-xs sm:text-sm">
                <Pill className="h-4 w-4" />
                <span className="hidden sm:inline">Controlada</span>
              </TabsTrigger>
              <TabsTrigger value="atestado" className="flex items-center gap-1 text-xs sm:text-sm">
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">Atestado</span>
              </TabsTrigger>
              <TabsTrigger value="comparecimento" className="flex items-center gap-1 text-xs sm:text-sm">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Comparec.</span>
              </TabsTrigger>
              <TabsTrigger value="exames" className="flex items-center gap-1 text-xs sm:text-sm">
                <FlaskConical className="h-4 w-4" />
                <span className="hidden sm:inline">Exames</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="receituario" className="mt-4 space-y-4">
              {/* Top action buttons with auto-save indicator */}
              <div className="flex items-center justify-between">
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>
              
              <div>
                <Label>Prescrição</Label>
                <Textarea
                  value={prescription}
                  onChange={(e) => handlePrescriptionChange(e.target.value)}
                  placeholder="Digite a prescrição médica..."
                  className="mt-1.5 min-h-[200px] font-mono"
                />
              </div>

              {/* Preview */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-medium">Pré-visualização</div>
                <div className="overflow-auto max-h-[400px] bg-gray-100">
                  <div className="transform scale-50 origin-top-left">
                    <PrescriptionPrint
                      ref={prescriptionRef}
                      clinic={clinic}
                      patient={patient}
                      professional={professional}
                      prescription={prescription}
                      date={date}
                      settings={settings}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Receita Controlada Tab */}
            <TabsContent value="controlado" className="mt-4 space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Receita de Controle Especial (Tipo C)</strong> - Emitida em 2 vias conforme Portaria SVS/MS nº 344/98. 
                  A 1ª via fica retida na farmácia e a 2ª via fica com o paciente.
                </p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label>CPF do Paciente</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFetchKey((k) => k + 1)}
                      disabled={patientDataLoading}
                      className="h-7 px-2 text-xs"
                    >
                      {patientDataLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Buscando…
                        </>
                      ) : (
                        "Recarregar"
                      )}
                    </Button>
                  </div>
                  <Input
                    value={patientCpf}
                    onChange={(e) => setPatientCpf(e.target.value)}
                    placeholder={patientDataLoading ? "Carregando..." : "000.000.000-00"}
                    className="mt-1.5"
                    disabled={patientDataLoading}
                  />
                </div>
                <div>
                  <Label>Endereço do Paciente</Label>
                  <Input
                    value={patientAddress}
                    onChange={(e) => setPatientAddress(e.target.value)}
                    placeholder={patientDataLoading ? "Carregando..." : "Rua, número, bairro, cidade/UF"}
                    className="mt-1.5"
                    disabled={patientDataLoading}
                  />
                </div>
              </div>

              {patientDataError && (
                <p className="text-sm text-destructive">{patientDataError}</p>
              )}

              <div>
                <Label>Medicamento Controlado</Label>
                <Textarea
                  value={controlledPrescription}
                  onChange={(e) => setControlledPrescription(e.target.value)}
                  placeholder="Nome do medicamento (nome genérico), concentração, forma farmacêutica&#10;Quantidade: XX (por extenso)&#10;Posologia: 1 comprimido a cada 12 horas por 30 dias"
                  className="mt-1.5 min-h-[150px] font-mono"
                />
              </div>

              {/* Preview */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-medium flex items-center gap-2">
                  <span>Pré-visualização (2 vias)</span>
                  <span className="text-xs text-muted-foreground">- Role para ver ambas as vias</span>
                </div>
                <div className="overflow-auto max-h-[400px] bg-gray-100">
                  <div className="transform scale-[0.35] origin-top-left">
                    <ControlledPrescriptionPrint
                      ref={controlledPrescriptionRef}
                      clinic={clinic}
                      patient={{
                        name: patient.name,
                        cpf: patientCpf,
                        address: patientAddress,
                      }}
                      professional={professional}
                      prescription={controlledPrescription}
                      date={date}
                      settings={settings}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="atestado" className="mt-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Dias de Afastamento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={certificateDays}
                    onChange={(e) => setCertificateDays(parseInt(e.target.value) || 1)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>CID (opcional)</Label>
                  <CidSearch
                    value={certificateReason}
                    onChange={setCertificateReason}
                    placeholder="Buscar CID..."
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-medium">Pré-visualização</div>
                <div className="overflow-auto max-h-[400px] bg-gray-100">
                  <div className="transform scale-50 origin-top-left">
                    <MedicalCertificatePrint
                      ref={certificateRef}
                      clinic={clinic}
                      patient={patient}
                      professional={professional}
                      date={date}
                      days={certificateDays}
                      reason={certificateReason}
                      settings={settings}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="comparecimento" className="mt-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Horário de Entrada</Label>
                  <Input
                    type="time"
                    value={attendanceStartTime}
                    onChange={(e) => setAttendanceStartTime(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Horário de Saída</Label>
                  <Input
                    type="time"
                    value={attendanceEndTime}
                    onChange={(e) => setAttendanceEndTime(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-medium">Pré-visualização</div>
                <div className="overflow-auto max-h-[400px] bg-gray-100">
                  <div className="transform scale-50 origin-top-left">
                    <AttendanceDeclarationPrint
                      ref={attendanceRef}
                      clinic={clinic}
                      patient={patient}
                      professional={professional}
                      date={date}
                      startTime={attendanceStartTime}
                      endTime={attendanceEndTime}
                      settings={settings}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="exames" className="mt-4 space-y-4">
              <div>
                <Label>Exames Solicitados</Label>
                <Textarea
                  value={examRequest}
                  onChange={(e) => setExamRequest(e.target.value)}
                  placeholder={"1. Hemograma completo\n2. Glicemia de jejum\n3. Colesterol total e frações\n4. Triglicerídeos\n5. Creatinina\n..."}
                  className="mt-1.5 min-h-[150px] font-mono"
                />
              </div>
              
              <div>
                <Label>Indicação Clínica (opcional)</Label>
                <Input
                  value={clinicalIndication}
                  onChange={(e) => setClinicalIndication(e.target.value)}
                  placeholder="Ex: Investigação de diabetes, check-up anual"
                  className="mt-1.5"
                />
              </div>

              {/* Preview */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-medium">Pré-visualização</div>
                <div className="overflow-auto max-h-[400px] bg-gray-100">
                  <div className="transform scale-50 origin-top-left">
                    <ExamRequestPrint
                      ref={examRequestRef}
                      clinic={clinic}
                      patient={patient}
                      professional={professional}
                      examRequest={examRequest}
                      clinicalIndication={clinicalIndication}
                      date={date}
                      settings={settings}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {/* WhatsApp button - only for exams tab */}
            {activeTab === "exames" && (
              <Button 
                variant="outline" 
                className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                onClick={() => setShowWhatsAppDialog(true)}
                disabled={!examRequest.trim()}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar via WhatsApp
              </Button>
            )}
            
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir {getTabTitle(activeTab)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp phone dialog */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Enviar Solicitação por WhatsApp
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Número do WhatsApp</Label>
              <Input
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="mt-1.5"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {patient.phone 
                  ? "Telefone do paciente já preenchido. Altere se necessário."
                  : "Paciente sem telefone cadastrado. Insira o número manualmente."}
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSendExamRequestWhatsApp}
                disabled={!whatsappPhone || sendingWhatsApp}
                className="bg-green-600 hover:bg-green-700"
              >
                {sendingWhatsApp ? (
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

      <DocumentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        clinicId={clinicId}
      />
    </>
  );
}
