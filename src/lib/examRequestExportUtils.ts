import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExamRequestPDFOptions {
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
    cnpj?: string | null;
  };
  patient: {
    name: string;
  };
  professional?: {
    name: string;
    specialty?: string | null;
    registration_number?: string | null;
  };
  examRequest: string;
  clinicalIndication?: string;
  date: string;
}

export async function generateExamRequestPDF(options: ExamRequestPDFOptions): Promise<{
  base64: string;
  fileName: string;
}> {
  const { clinic, patient, professional, examRequest, clinicalIndication, date } = options;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header - Clinic Name
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(clinic.name, pageWidth / 2, yPos, { align: "center" });
  yPos += 7;

  // Clinic details
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const clinicDetails: string[] = [];
  if (clinic.address) clinicDetails.push(clinic.address);
  if (clinic.phone) clinicDetails.push(`Tel: ${clinic.phone}`);
  if (clinic.cnpj) clinicDetails.push(`CNPJ: ${clinic.cnpj}`);
  
  if (clinicDetails.length > 0) {
    doc.text(clinicDetails.join(" • "), pageWidth / 2, yPos, { align: "center" });
    yPos += 10;
  }

  // Divider line
  doc.setDrawColor(200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 15;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SOLICITAÇÃO DE EXAMES", pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Patient info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Paciente: ", 15, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(patient.name, 42, yPos);
  yPos += 8;

  // Date
  doc.setFont("helvetica", "bold");
  doc.text("Data: ", 15, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(
    format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    30, yPos
  );
  yPos += 15;

  // Exams Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Exames Solicitados:", 15, yPos);
  yPos += 8;

  // Exam content
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  
  const splitContent = doc.splitTextToSize(examRequest, pageWidth - 40);
  doc.text(splitContent, 20, yPos);
  yPos += splitContent.length * 6 + 10;

  // Clinical Indication
  if (clinicalIndication) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Indicação Clínica:", 15, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const splitIndication = doc.splitTextToSize(clinicalIndication, pageWidth - 30);
    doc.text(splitIndication, 15, yPos);
    yPos += splitIndication.length * 6 + 20;
  }

  // Professional signature line
  yPos = Math.max(yPos, 220);
  doc.setDrawColor(0);
  doc.line(pageWidth / 2 - 40, yPos, pageWidth / 2 + 40, yPos);
  yPos += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(professional?.name || "Profissional", pageWidth / 2, yPos, { align: "center" });
  yPos += 5;

  if (professional?.specialty) {
    doc.setFont("helvetica", "normal");
    doc.text(professional.specialty, pageWidth / 2, yPos, { align: "center" });
    yPos += 5;
  }

  if (professional?.registration_number) {
    doc.setFont("helvetica", "normal");
    doc.text(professional.registration_number, pageWidth / 2, yPos, { align: "center" });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(
    "Documento gerado eletronicamente pelo sistema Eclini",
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  // Generate filename
  const sanitizedPatientName = patient.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const dateStr = format(new Date(date), "yyyy-MM-dd");
  const fileName = `solicitacao-exames-${sanitizedPatientName}-${dateStr}.pdf`;

  // Get base64
  const pdfDataUri = doc.output("datauristring");
  const base64 = pdfDataUri.split(",")[1];

  return { base64, fileName };
}
