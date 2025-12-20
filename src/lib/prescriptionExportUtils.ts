import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PrescriptionPDFOptions {
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
    cnpj?: string | null;
  };
  patient: {
    name: string;
    birth_date?: string | null;
  };
  professional?: {
    name: string;
    specialty?: string | null;
    registration_number?: string | null;
  };
  prescription: {
    content: string;
    created_at: string;
    signature_data?: string | null;
    is_signed?: boolean;
  };
}

export async function generatePrescriptionPDF(options: PrescriptionPDFOptions): Promise<{
  base64: string;
  fileName: string;
}> {
  const { clinic, patient, professional, prescription } = options;
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
  doc.text("RECEITUÁRIO", pageWidth / 2, yPos, { align: "center" });
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
    format(new Date(prescription.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    30, yPos
  );
  yPos += 15;

  // Prescription content
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  
  // Split content into lines and handle long text
  const splitContent = doc.splitTextToSize(prescription.content, pageWidth - 30);
  doc.text(splitContent, 15, yPos);
  yPos += splitContent.length * 6 + 30;

  // Signature area
  if (prescription.signature_data) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imgData = canvas.toDataURL("image/png");
            
            const maxWidth = 60;
            const maxHeight = 30;
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
              height = (maxWidth / width) * height;
              width = maxWidth;
            }
            if (height > maxHeight) {
              width = (maxHeight / height) * width;
              height = maxHeight;
            }
            
            doc.addImage(imgData, "PNG", pageWidth / 2 - width / 2, yPos, width, height);
            yPos += height + 5;
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = prescription.signature_data!;
      });
    } catch (error) {
      console.error("Error adding signature:", error);
    }
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
  const dateStr = format(new Date(prescription.created_at), "yyyy-MM-dd");
  const fileName = `receituario-${sanitizedPatientName}-${dateStr}.pdf`;

  // Get base64
  const pdfDataUri = doc.output("datauristring");
  const base64 = pdfDataUri.split(",")[1];

  return { base64, fileName };
}
