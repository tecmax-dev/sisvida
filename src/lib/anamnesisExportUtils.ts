import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  is_required: boolean | null;
  options?: { id: string; option_text: string }[];
}

interface Answer {
  question_id: string;
  answer_text: string | null;
  answer_option_ids: string[] | null;
}

interface ExportAnamnesisOptions {
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
    cnpj?: string | null;
  };
  patient: {
    name: string;
    phone: string;
  };
  template: {
    title: string;
  };
  questions: Question[];
  answers: Answer[];
  response: {
    created_at: string;
    filled_by_patient: boolean;
    signature_data: string | null;
    signed_at: string | null;
    responsibility_accepted: boolean;
  };
  signatureUrl: string | null;
}

const getAnswerDisplay = (question: Question, answer: Answer | undefined): string => {
  if (question.question_type === "boolean") {
    if (!answer || answer.answer_text === null || answer.answer_text === undefined || answer.answer_text === "false") {
      return "Não";
    }
    if (answer.answer_text === "true") {
      return "Sim";
    }
    return answer.answer_text;
  }
  
  if (!answer) return "Não respondido";
  
  if (question.question_type === "text" || question.question_type === "textarea" || question.question_type === "date" || question.question_type === "number") {
    return answer.answer_text || "Não respondido";
  }
  
  if (question.question_type === "radio" || question.question_type === "select" || question.question_type === "checkbox") {
    if (!answer.answer_option_ids || answer.answer_option_ids.length === 0) return "Não respondido";
    
    const selectedOptions = question.options
      ?.filter(opt => answer.answer_option_ids?.includes(opt.id))
      .map(opt => opt.option_text);
    
    return selectedOptions?.join(", ") || "Não respondido";
  }
  
  return answer.answer_text || "Não respondido";
};

export async function exportAnamnesisToPDF({
  clinic,
  patient,
  template,
  questions,
  answers,
  response,
  signatureUrl,
}: ExportAnamnesisOptions): Promise<void> {
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
  } else {
    yPos += 5;
  }

  // Divider line
  doc.setDrawColor(200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 10;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE ANAMNESE", pageWidth / 2, yPos, { align: "center" });
  yPos += 7;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(template.title, pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // Patient info box
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPos, pageWidth - 30, 20, "F");
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Paciente: ", 20, yPos + 7);
  doc.setFont("helvetica", "normal");
  doc.text(patient.name, 45, yPos + 7);
  
  doc.setFont("helvetica", "bold");
  doc.text("Telefone: ", 120, yPos + 7);
  doc.setFont("helvetica", "normal");
  doc.text(patient.phone, 145, yPos + 7);
  
  doc.setFont("helvetica", "bold");
  doc.text("Data: ", 20, yPos + 15);
  doc.setFont("helvetica", "normal");
  doc.text(
    format(new Date(response.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    35, yPos + 15
  );
  
  yPos += 30;

  // Questions and Answers
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Perguntas e Respostas", 15, yPos);
  yPos += 8;

  // Create table data
  const tableData = questions.map((question, index) => {
    const answer = answers.find(a => a.question_id === question.id);
    const answerDisplay = getAnswerDisplay(question, answer);
    return [
      `${index + 1}. ${question.question_text}${question.is_required ? " *" : ""}`,
      answerDisplay,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [["Pergunta", "Resposta"]],
    body: tableData,
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: "auto" },
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    margin: { left: 15, right: 15 },
    didDrawPage: () => {
      // Footer on each page
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(128);
      doc.text(
        `Página ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    },
  });

  yPos = (doc as any).lastAutoTable?.finalY + 15 || yPos + 15;

  // Check if we need a new page for signature
  if (response.filled_by_patient && response.signature_data && yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  // Signature Section
  if (response.filled_by_patient && response.signature_data) {
    doc.setDrawColor(200);
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Assinatura Digital", 15, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(34, 139, 34); // Green color
    doc.text("✓ Preenchido pelo paciente", 15, yPos);
    yPos += 6;

    if (response.responsibility_accepted) {
      doc.setTextColor(100);
      doc.text("✓ O paciente aceitou o termo de responsabilidade sobre as informações fornecidas.", 15, yPos);
      yPos += 6;
    }

    if (response.signed_at) {
      doc.setTextColor(100);
      doc.text(
        `Assinado em: ${format(new Date(response.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        15, yPos
      );
      yPos += 10;
    }

    // Add signature image if available
    if (signatureUrl) {
      try {
        // Create a temporary image to load the signature
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imgData = canvas.toDataURL("image/png");
              
              // Calculate dimensions to fit
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
              
              doc.addImage(imgData, "PNG", 15, yPos, width, height);
            }
            resolve();
          };
          img.onerror = () => {
            console.error("Failed to load signature image");
            resolve(); // Continue without signature
          };
          img.src = signatureUrl;
        });
      } catch (error) {
        console.error("Error adding signature to PDF:", error);
      }
    }
  }

  // Generate filename and save
  const sanitizedPatientName = patient.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const dateStr = format(new Date(response.created_at), "yyyy-MM-dd");
  const filename = `anamnese-${sanitizedPatientName}-${dateStr}.pdf`;
  
  doc.save(filename);
}
