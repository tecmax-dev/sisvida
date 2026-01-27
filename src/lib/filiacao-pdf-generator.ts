import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Brand Colors
const COLORS = {
  primary: [15, 23, 42] as [number, number, number],
  accent: [16, 185, 129] as [number, number, number],
  purple: [147, 51, 234] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  light: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

interface Filiacao {
  id: string;
  nome: string;
  cpf: string;
  rg?: string | null;
  data_nascimento: string;
  sexo?: string | null;
  estado_civil?: string | null;
  nome_pai?: string | null;
  nome_mae?: string | null;
  email: string;
  telefone: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cargo?: string | null;
  data_admissao?: string | null;
  empresa_razao_social?: string | null;
  empresa_cnpj?: string | null;
  forma_pagamento?: string | null;
  assinatura_digital_url?: string | null;
  assinatura_aceite_desconto?: boolean | null;
  assinatura_aceite_at?: string | null;
  matricula?: string | null;
  created_at: string;
  aprovado_at?: string | null;
}

interface Dependent {
  nome: string;
  grau_parentesco: string;
  data_nascimento?: string | null;
}

interface Sindicato {
  razao_social: string;
  logo_url?: string | null;
}

const formatCPF = (cpf: string) => {
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const paymentMethodLabels: Record<string, string> = {
  desconto_folha: "Desconto em Folha",
  boleto: "Boleto Bancário",
  pix: "PIX",
  debito_automatico: "Débito Automático",
};

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function buildFiliacaoPDF(
  filiacao: Filiacao,
  dependents: Dependent[],
  sindicato?: Sindicato | null
): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header with gradient effect
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 40, "F");

  // Accent line
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 40, pageWidth, 3, "F");

  // Logo
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 10, 6, 28, 28);
      }
    } catch (e) {
      console.warn("Failed to load logo:", e);
    }
  }

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE FILIAÇÃO", pageWidth / 2, 18, { align: "center" });

  // Sindicato name
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(sindicato?.razao_social || "Sindicato", pageWidth / 2, 28, { align: "center" });

  // Matricula badge
  if (filiacao.matricula) {
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(`Matrícula: ${filiacao.matricula}`, pageWidth / 2, 36, { align: "center" });
  }

  let yPos = 52;

  // CPF Highlight Card - FIRST AND PROMINENT
  doc.setFillColor(239, 246, 255); // Light blue background
  doc.roundedRect(14, yPos, pageWidth - 28, 16, 2, 2, "F");
  doc.setFillColor(59, 130, 246); // Blue accent
  doc.rect(14, yPos, 4, 16, "F");
  
  doc.setFontSize(10);
  doc.setTextColor(30, 64, 175); // Dark blue
  doc.setFont("helvetica", "bold");
  doc.text("CPF:", 22, yPos + 10);
  doc.setFontSize(14);
  doc.text(formatCPF(filiacao.cpf), 40, yPos + 10);
  
  yPos += 22;

  // Member name card
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(14, yPos, pageWidth - 28, 18, 2, 2, "F");
  doc.setFillColor(...COLORS.accent);
  doc.rect(14, yPos, 3, 18, "F");

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.text(filiacao.nome, 22, yPos + 12);

  yPos += 26;

  // Filiação date highlight (if approved)
  if (filiacao.aprovado_at) {
    doc.setFillColor(236, 253, 245); // Light green background
    doc.roundedRect(14, yPos, pageWidth - 28, 14, 2, 2, "F");
    doc.setFillColor(16, 185, 129); // Green accent
    doc.rect(14, yPos, 4, 14, "F");
    
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70); // Dark green
    doc.setFont("helvetica", "bold");
    doc.text("DATA DE FILIAÇÃO:", 22, yPos + 9);
    doc.setFontSize(11);
    doc.text(format(new Date(filiacao.aprovado_at), "dd/MM/yyyy", { locale: ptBR }), 80, yPos + 9);
    
    yPos += 20;
  }

  // Personal Data Section
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS PESSOAIS", 14, yPos);
  yPos += 6;

  const personalData = [
    ["RG", filiacao.rg || "-"],
    ["Data de Nascimento", filiacao.data_nascimento ? format(new Date(filiacao.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : "-"],
    ["Sexo", filiacao.sexo || "-"],
    ["Estado Civil", filiacao.estado_civil || "-"],
    ["Nome do Pai", filiacao.nome_pai || "-"],
    ["Nome da Mãe", filiacao.nome_mae || "-"],
    ["E-mail", filiacao.email],
    ["Telefone", filiacao.telefone],
  ];

  autoTable(doc, {
    startY: yPos,
    body: personalData,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, textColor: COLORS.muted },
      1: { cellWidth: 90 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Address Section
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.text("ENDEREÇO", 14, yPos);
  yPos += 6;

  const fullAddress = [
    filiacao.logradouro,
    filiacao.numero ? `nº ${filiacao.numero}` : null,
    filiacao.complemento,
  ].filter(Boolean).join(", ");

  const cityState = [filiacao.bairro, filiacao.cidade, filiacao.uf].filter(Boolean).join(" - ");

  const addressData = [
    ["Endereço", fullAddress || "-"],
    ["Bairro/Cidade/UF", cityState || "-"],
    ["CEP", filiacao.cep || "-"],
  ];

  autoTable(doc, {
    startY: yPos,
    body: addressData,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, textColor: COLORS.muted },
      1: { cellWidth: 90 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Company Section
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS PROFISSIONAIS", 14, yPos);
  yPos += 6;

  const companyData = [
    ["Empresa", filiacao.empresa_razao_social || "-"],
    ["CNPJ", filiacao.empresa_cnpj || "-"],
    ["Cargo/Função", filiacao.cargo || "-"],
    ["Data de Admissão", filiacao.data_admissao ? format(new Date(filiacao.data_admissao + "T12:00:00"), "dd/MM/yyyy") : "-"],
    ["Forma de Pagamento", filiacao.forma_pagamento ? paymentMethodLabels[filiacao.forma_pagamento] || filiacao.forma_pagamento : "-"],
  ];

  autoTable(doc, {
    startY: yPos,
    body: companyData,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, textColor: COLORS.muted },
      1: { cellWidth: 90 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Dependents Section (if any)
  if (dependents.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.text("DEPENDENTES", 14, yPos);
    yPos += 6;

    const depsTableData = dependents.map((d) => [
      d.nome,
      d.grau_parentesco,
      d.data_nascimento ? format(new Date(d.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : "-",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Nome", "Parentesco", "Data Nasc."]],
      body: depsTableData,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: COLORS.accent,
        textColor: COLORS.white,
        fontStyle: "bold",
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // Authorization Section
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(14, yPos, pageWidth - 28, 35, 2, 2, "F");

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.text("AUTORIZAÇÃO DE DESCONTO", 20, yPos + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);

  const authText = `Autorizo o desconto mensal da contribuição sindical equivalente a 2% do menor piso salarial da categoria, conforme estabelecido em convenção coletiva de trabalho, a ser efetuado diretamente em folha de pagamento ou pela forma de pagamento escolhida acima.`;

  const lines = doc.splitTextToSize(authText, pageWidth - 48);
  doc.text(lines, 20, yPos + 15);

  // Signature
  yPos += 42;

  if (filiacao.assinatura_digital_url) {
    try {
      const sigBase64 = await loadImageAsBase64(filiacao.assinatura_digital_url);
      if (sigBase64) {
        doc.addImage(sigBase64, "PNG", pageWidth / 2 - 30, yPos, 60, 20);
        yPos += 22;
      }
    } catch (e) {
      console.warn("Failed to load signature:", e);
    }
  }

  // Signature line
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2 - 40, yPos, pageWidth / 2 + 40, yPos);

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("Assinatura do Associado", pageWidth / 2, yPos + 5, { align: "center" });

  if (filiacao.assinatura_aceite_at) {
    doc.text(
      `Assinado digitalmente em ${format(new Date(filiacao.assinatura_aceite_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      yPos + 10,
      { align: "center" }
    );
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    14,
    pageHeight - 8
  );

  if (filiacao.aprovado_at) {
    doc.text(
      `Filiação aprovada em ${format(new Date(filiacao.aprovado_at), "dd/MM/yyyy", { locale: ptBR })}`,
      pageWidth - 14,
      pageHeight - 8,
      { align: "right" }
    );
  }

  return doc;
}

/**
 * Generate a Filiacao PDF and return as Blob (for bulk generation)
 */
export async function generateFiliacaoPDFBlob(
  filiacao: Filiacao,
  dependents: Dependent[],
  sindicato?: Sindicato | null
): Promise<Blob> {
  const doc = await buildFiliacaoPDF(filiacao, dependents, sindicato);
  return doc.output("blob");
}

/**
 * Generate a Filiacao PDF and trigger download
 */
export async function generateFichaFiliacaoPDF(
  filiacao: Filiacao,
  dependents: Dependent[],
  sindicato?: Sindicato | null
): Promise<void> {
  const doc = await buildFiliacaoPDF(filiacao, dependents, sindicato);
  const fileName = `ficha-filiacao-${filiacao.nome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`;
  doc.save(fileName);
}
