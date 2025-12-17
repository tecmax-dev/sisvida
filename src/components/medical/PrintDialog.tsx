import { useState, useRef } from "react";
import { Printer, FileText, Award, ClipboardCheck } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrescriptionPrint } from "./PrescriptionPrint";
import { MedicalCertificatePrint } from "./MedicalCertificatePrint";
import { AttendanceDeclarationPrint } from "./AttendanceDeclarationPrint";

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
  patient: {
    name: string;
  };
  professional?: {
    name: string;
    specialty?: string;
    registration_number?: string;
  };
  initialPrescription?: string;
  date: string;
}

const getTabTitle = (tab: string) => {
  switch (tab) {
    case "receituario": return "Receituário";
    case "atestado": return "Atestado";
    case "comparecimento": return "Declaração de Comparecimento";
    default: return "Documento";
  }
};

export function PrintDialog({
  open,
  onOpenChange,
  clinic,
  patient,
  professional,
  initialPrescription = "",
  date,
}: PrintDialogProps) {
  const [prescription, setPrescription] = useState(initialPrescription);
  const [certificateDays, setCertificateDays] = useState(1);
  const [certificateReason, setCertificateReason] = useState("");
  const [attendanceStartTime, setAttendanceStartTime] = useState("08:00");
  const [attendanceEndTime, setAttendanceEndTime] = useState("09:00");
  const [activeTab, setActiveTab] = useState("receituario");
  
  const prescriptionRef = useRef<HTMLDivElement>(null);
  const certificateRef = useRef<HTMLDivElement>(null);
  const attendanceRef = useRef<HTMLDivElement>(null);

  const getPrintContent = () => {
    switch (activeTab) {
      case "receituario": return prescriptionRef.current;
      case "atestado": return certificateRef.current;
      case "comparecimento": return attendanceRef.current;
      default: return null;
    }
  };

  const handlePrint = () => {
    const printContent = getPrintContent();
    
    if (!printContent) return;

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
              size: A4;
              margin: 0;
            }
            @media print {
              body {
                width: 210mm;
                min-height: 297mm;
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
            .mb-2 { margin-bottom: 0.5rem; }
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
            .text-primary { color: #0d9488; }
            .leading-relaxed { line-height: 1.625; }
            .leading-loose { line-height: 2; }
            .whitespace-pre-wrap { white-space: pre-wrap; }
            .min-h-\\[400px\\] { min-height: 400px; }
            .w-64 { width: 16rem; }
            .h-16 { height: 4rem; }
            .object-contain { object-fit: contain; }
            strong { font-weight: bold; }
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Impressão de Documentos - {patient.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="receituario" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Receituário</span>
            </TabsTrigger>
            <TabsTrigger value="atestado" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">Atestado</span>
            </TabsTrigger>
            <TabsTrigger value="comparecimento" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Comparecimento</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receituario" className="mt-4 space-y-4">
            <div>
              <Label>Prescrição</Label>
              <Textarea
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
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
                <Input
                  value={certificateReason}
                  onChange={(e) => setCertificateReason(e.target.value)}
                  placeholder="Ex: J11 - Gripe"
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
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir {getTabTitle(activeTab)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
