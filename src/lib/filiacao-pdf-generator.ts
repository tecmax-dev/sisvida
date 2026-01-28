import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Brand Colors matching the SECMI model exactly
const COLORS = {
  red: [139, 26, 26] as [number, number, number], // Dark red/maroon
  darkRed: [100, 20, 20] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [200, 200, 200] as [number, number, number],
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
  cns?: string | null;
  empresa_segmento?: string | null;
  empresa_endereco?: string | null;
  empresa_bairro?: string | null;
  empresa_cidade?: string | null;
  empresa_uf?: string | null;
  empresa_telefone?: string | null;
}

interface Sindicato {
  razao_social: string;
  logo_url?: string | null;
  cnpj?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface GenerationOptions {
  cardExpiresAt?: string | null;
}

const formatCPF = (cpf: string) => {
  if (!cpf) return "";
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatPhone = (phone: string) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr + "T12:00:00"), "dd/MM/yyyy");
  } catch {
    return "";
  }
};

const formatDateLong = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return "";
  }
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

// Draw curved red decoration in top-left corner
function drawHeaderDecoration(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Red curved shape on left side
  doc.setFillColor(...COLORS.red);
  doc.setDrawColor(...COLORS.red);
  
  // Draw curved shape using bezier-like approach with multiple arcs
  // Main curve from top
  doc.moveTo(0, 0);
  doc.lineTo(60, 0);
  // Create curve effect with triangles
  doc.triangle(0, 0, 60, 0, 0, 80, "F");
  
  // Add secondary curve layer for depth
  doc.setFillColor(...COLORS.darkRed);
  doc.triangle(0, 0, 40, 0, 0, 55, "F");
  
  // Red line under title
  doc.setFillColor(...COLORS.red);
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(2);
  doc.line(70, 28, pageWidth - 14, 28);
}

async function buildFiliacaoPDF(
  filiacao: Filiacao,
  _dependents: unknown[],
  sindicato?: Sindicato | null,
  _options?: GenerationOptions
): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ========== HEADER DECORATION (curved red shape) ==========
  drawHeaderDecoration(doc);

  // Logo on top-left (over the curve)
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 8, 5, 28, 28);
      }
    } catch (e) {
      console.warn("Failed to load logo:", e);
    }
  }

  // Sindicato name (right-aligned, bold, dark red)
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.red);
  doc.setFont("helvetica", "bold");
  const sindicatoName = sindicato?.razao_social?.toUpperCase() || "SINDICATO";
  doc.text(sindicatoName, pageWidth - margin, 18, { align: "right" });

  // CNPJ below title
  if (sindicato?.cnpj) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    doc.text(sindicato.cnpj, pageWidth / 2, 38, { align: "center" });
  }

  let yPos = 55;

  // ========== TITLE: FICHA DE SÓCIO ==========
  doc.setFontSize(26);
  doc.setTextColor(...COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE SÓCIO", pageWidth / 2, yPos, { align: "center" });

  yPos += 10;

  // "Filiado desde" date
  const filiadoDesde = filiacao.aprovado_at
    ? formatDate(filiacao.aprovado_at)
    : formatDate(filiacao.created_at);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.gray);
  doc.text(`Filiado desde ${filiadoDesde}`, pageWidth / 2, yPos, { align: "center" });

  yPos += 16;

  // ========== DADOS DO SÓCIO SECTION ==========
  doc.setFontSize(14);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...COLORS.black);
  doc.text("Dados do Sócio", margin, yPos);

  // Underline
  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

  yPos += 12;

  // Grid layout for member data (3 columns like the model)
  const col1X = margin;
  const col2X = margin + 65;
  const col3X = margin + 130;
  const lineHeight = 7;

  const drawField = (label: string, value: string, x: number, y: number, maxWidth?: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.black);
    doc.text(`${label}:`, x, y);
    doc.setFont("helvetica", "normal");
    const labelWidth = doc.getTextWidth(`${label}: `);
    const displayValue = value || "";
    if (maxWidth) {
      doc.text(displayValue, x + labelWidth, y, { maxWidth: maxWidth - labelWidth });
    } else {
      doc.text(displayValue, x + labelWidth, y);
    }
  };

  // Row 1 - Nome Completo (full width) + Matrícula + Telefone
  drawField("Nome Completo", filiacao.nome, col1X, yPos, 60);
  drawField("Matrícula", filiacao.matricula || "", col2X, yPos);
  drawField("Telefone", "", col3X, yPos);
  yPos += lineHeight;

  // Row 2
  drawField("Nascimento", formatDate(filiacao.data_nascimento), col1X, yPos);
  drawField("Celular", formatPhone(filiacao.telefone), col2X, yPos);
  drawField("RG", filiacao.rg || "", col3X, yPos);
  yPos += lineHeight;

  // Row 3
  drawField("E-mail", filiacao.email || "", col1X, yPos, 60);
  drawField("CPF", formatCPF(filiacao.cpf), col2X, yPos);
  drawField("Cidade", `${filiacao.cidade || ""} - ${filiacao.uf || ""}`, col3X, yPos);
  yPos += lineHeight;

  // Row 4
  const endereco = [filiacao.logradouro, filiacao.numero].filter(Boolean).join(", ");
  drawField("Endereço", endereco, col1X, yPos, 60);
  drawField("Bairro", filiacao.bairro || "", col2X, yPos);
  drawField("Nome do pai", filiacao.nome_pai || "", col3X, yPos);
  yPos += lineHeight;

  // Row 5
  drawField("CNS", filiacao.cns || "", col1X, yPos);
  drawField("Nome da mãe", filiacao.nome_mae || "", col2X, yPos);
  doc.setFont("helvetica", "bold");
  doc.text("Filiado:", col3X, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(" Sim", col3X + doc.getTextWidth("Filiado: "), yPos);
  yPos += 16;

  // ========== DADOS PROFISSIONAIS SECTION ==========
  doc.setFontSize(14);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...COLORS.black);
  doc.text("Dados profissionais", margin, yPos);
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

  yPos += 12;

  // Company data (matching model layout)
  drawField("Nome Empresas", filiacao.empresa_razao_social || "", col1X, yPos, 120);
  yPos += lineHeight;

  drawField("Segmento", filiacao.empresa_segmento || "Comércio Varejista", col1X, yPos);
  drawField("Bairro", filiacao.empresa_bairro || "", col3X, yPos);
  yPos += lineHeight;

  drawField("Endereço", filiacao.empresa_endereco || "", col1X, yPos, 100);
  drawField("Telefone", filiacao.empresa_telefone || "", col3X, yPos);
  yPos += lineHeight;

  const empresaCidade = filiacao.empresa_cidade || filiacao.cidade || "";
  const empresaUf = filiacao.empresa_uf || filiacao.uf || "";
  drawField("Cidade", `${empresaCidade} - ${empresaUf}`, col1X, yPos);
  drawField("Admissão", filiacao.data_admissao ? formatDate(filiacao.data_admissao) : "Não informado", col3X, yPos);
  yPos += lineHeight;

  drawField("Funções", filiacao.cargo || "", col1X, yPos);
  yPos += 20;

  // ========== WATERMARK (Logo in center, faded) - Large like model ==========
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        doc.saveGraphicsState();
        // @ts-ignore - setGState exists in jsPDF
        doc.setGState(new doc.GState({ opacity: 0.12 }));
        // Large centered watermark like in the model
        const watermarkSize = 130;
        doc.addImage(
          logoBase64,
          "PNG",
          pageWidth / 2 - watermarkSize / 2,
          yPos - 30,
          watermarkSize,
          watermarkSize
        );
        doc.restoreGraphicsState();
      }
    } catch (e) {
      console.warn("Failed to load watermark:", e);
    }
  }

  // ========== DATE AND SIGNATURE ==========
  const cidade = sindicato?.cidade || filiacao.cidade || "";
  const dataFormatada = filiacao.aprovado_at
    ? formatDateLong(filiacao.aprovado_at)
    : formatDateLong(new Date().toISOString());

  yPos += 35;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.black);
  doc.text(`${cidade.toUpperCase()}, ${dataFormatada}`, pageWidth / 2, yPos, { align: "center" });

  yPos += 30;

  // Signature line
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - 60, yPos, pageWidth / 2 + 60, yPos);

  doc.setFontSize(11);
  doc.text("Assinatura do Sócio", pageWidth / 2, yPos + 6, { align: "center" });

  // Add digital signature if exists
  if (filiacao.assinatura_digital_url) {
    try {
      const sigBase64 = await loadImageAsBase64(filiacao.assinatura_digital_url);
      if (sigBase64) {
        doc.addImage(sigBase64, "PNG", pageWidth / 2 - 35, yPos - 25, 70, 22);
      }
    } catch (e) {
      console.warn("Failed to load signature:", e);
    }
  }

  // ========== BOTTOM STUB (VIA EMPRESA) - Matching model exactly ==========
  const stubY = pageHeight - 62;

  // Dashed line separator
  doc.setDrawColor(...COLORS.gray);
  doc.setLineDashPattern([3, 2], 0);
  doc.setLineWidth(0.5);
  doc.line(margin, stubY, pageWidth - margin, stubY);
  doc.setLineDashPattern([], 0);

  // Stub content area with border
  const stubStartY = stubY + 6;
  const stubHeight = 52;
  
  // Draw border around stub content
  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.rect(margin, stubStartY, pageWidth - margin * 2, stubHeight - 10);

  // Row 1: Logo + Autorização + Checkboxes + Matrícula
  const row1Y = stubStartY + 8;

  // Small logo
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", margin + 3, row1Y - 4, 14, 14);
      }
    } catch (e) {
      console.warn("Failed to load stub logo:", e);
    }
  }

  // "Autorização de Desconto"
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.black);
  doc.text("Autorização de Desconto", margin + 22, row1Y + 3);

  // "Desconto em Folha:" with checkboxes
  doc.setFontSize(10);
  doc.text("Desconto em Folha:", margin + 85, row1Y + 3);
  
  const descontoFolha = filiacao.forma_pagamento === "desconto_folha";
  
  // Sim checkbox
  doc.setLineWidth(0.4);
  doc.setDrawColor(...COLORS.black);
  doc.rect(margin + 130, row1Y - 2, 4, 4);
  if (descontoFolha) {
    doc.setFillColor(...COLORS.black);
    doc.rect(margin + 130.5, row1Y - 1.5, 3, 3, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.text("Sim", margin + 136, row1Y + 2);

  // Não checkbox
  doc.rect(margin + 150, row1Y - 2, 4, 4);
  if (!descontoFolha) {
    doc.setFillColor(...COLORS.black);
    doc.rect(margin + 150.5, row1Y - 1.5, 3, 3, "F");
  }
  doc.text("Não", margin + 156, row1Y + 2);

  // Vertical separator
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 40, stubStartY + 2, pageWidth - margin - 40, row1Y + 12);

  // Matrícula box on right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Matrícula:", pageWidth - margin - 35, row1Y - 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(filiacao.matricula || "", pageWidth - margin - 35, row1Y + 6);

  // Assinatura label on far right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Assinatura:", pageWidth - margin - 35, row1Y + 14);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 35, row1Y + 22, pageWidth - margin - 2, row1Y + 22);

  // Row 2: Nome completo
  const row2Y = row1Y + 14;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Nome completo:", margin + 3, row2Y);
  doc.setFont("helvetica", "normal");
  doc.text(filiacao.nome, margin + 3, row2Y + 5);

  // Row 3: Empresa onde trabalha + Nº Registro + Local + Inscrição
  const row3Y = row2Y + 14;
  
  doc.setFont("helvetica", "bold");
  doc.text("Empresa onde trabalha:", margin + 3, row3Y);
  doc.setFont("helvetica", "normal");
  doc.text(filiacao.empresa_razao_social || "", margin + 3, row3Y + 5);

  // Table for Nº Registro, Local, Inscrição
  const tableX = margin + 65;
  const cellWidth = 35;
  
  // Draw table borders
  doc.setLineWidth(0.2);
  doc.rect(tableX, row3Y - 4, cellWidth, 12);
  doc.rect(tableX + cellWidth, row3Y - 4, cellWidth, 12);
  doc.rect(tableX + cellWidth * 2, row3Y - 4, cellWidth, 12);

  // Table headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Nº Registro:", tableX + 2, row3Y);
  doc.text("Local:", tableX + cellWidth + 2, row3Y);
  doc.text("Inscrição:", tableX + cellWidth * 2 + 2, row3Y);

  // Table values
  doc.setFont("helvetica", "normal");
  doc.text("...", tableX + 2, row3Y + 5);
  doc.text((filiacao.cidade || "").toUpperCase(), tableX + cellWidth + 2, row3Y + 5);
  doc.text(formatDate(filiacao.aprovado_at || filiacao.created_at), tableX + cellWidth * 2 + 2, row3Y + 5);

  // VIA EMPRESA footer bar
  const footerY = pageHeight - 8;
  doc.setFillColor(...COLORS.red);
  doc.rect(margin, footerY - 6, pageWidth - margin * 2, 10, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("VIA EMPRESA", pageWidth / 2, footerY + 1, { align: "center" });

  return doc;
}

/**
 * Generate a Filiacao PDF and return as Blob (for bulk generation)
 */
export async function generateFiliacaoPDFBlob(
  filiacao: Filiacao,
  dependents: unknown[],
  sindicato?: Sindicato | null,
  cardExpiresAt?: string | null
): Promise<Blob> {
  const doc = await buildFiliacaoPDF(filiacao, dependents, sindicato, { cardExpiresAt });
  return doc.output("blob");
}

/**
 * Generate a Filiacao PDF and trigger download
 */
export async function generateFichaFiliacaoPDF(
  filiacao: Filiacao,
  dependents: unknown[],
  sindicato?: Sindicato | null
): Promise<void> {
  const doc = await buildFiliacaoPDF(filiacao, dependents, sindicato);
  const fileName = `ficha-filiacao-${filiacao.nome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`;
  doc.save(fileName);
}
