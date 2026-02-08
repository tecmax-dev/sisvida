import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Brand Colors matching the SECMI model - dark red/maroon with gold accents
const COLORS = {
  red: [139, 26, 26] as [number, number, number], // Dark red/maroon
  darkRed: [100, 20, 20] as [number, number, number],
  gold: [212, 175, 55] as [number, number, number], // Gold accent
  black: [0, 0, 0] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
  lightGray: [200, 200, 200] as [number, number, number],
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
  empresa_matricula?: string | null;
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
  foto_url?: string | null;
  documento_foto_url?: string | null;
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

const formatCNPJ = (cnpj: string) => {
  if (!cnpj) return "";
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
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
    // Handle both date-only (YYYY-MM-DD) and full timestamp formats
    const dateToFormat = dateStr.includes("T") 
      ? new Date(dateStr) 
      : new Date(dateStr + "T12:00:00");
    return format(dateToFormat, "dd/MM/yyyy");
  } catch {
    return "";
  }
};

const formatDateLong = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  try {
    // Handle both date-only and full timestamp formats
    const dateToFormat = dateStr.includes("T") 
      ? new Date(dateStr) 
      : new Date(dateStr + "T12:00:00");
    return format(dateToFormat, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
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

// Draw curved header decoration matching the model (red + gold curves on left)
function drawHeaderDecoration(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Main red curved shape on left side (smaller to avoid overlap)
  doc.setFillColor(...COLORS.red);
  
  // Draw the main red curve - outer
  doc.triangle(0, 0, 55, 0, 0, 70, "F");
  
  // Gold accent curve (inner)
  doc.setFillColor(...COLORS.gold);
  doc.triangle(0, 0, 42, 0, 0, 55, "F");
  
  // Darker red inner layer
  doc.setFillColor(...COLORS.darkRed);
  doc.triangle(0, 0, 28, 0, 0, 38, "F");

  // Red line under title extending across page (starting after logo area)
  doc.setFillColor(...COLORS.red);
  doc.setLineWidth(2.5);
  doc.setDrawColor(...COLORS.red);
  doc.line(48, 28, pageWidth - 10, 28);
  
  // Gold accent line
  doc.setLineWidth(1);
  doc.setDrawColor(...COLORS.gold);
  doc.line(48, 31, pageWidth - 10, 31);
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

  // ========== HEADER DECORATION (curved red/gold shape) ==========
  drawHeaderDecoration(doc);

  // Logo on top-left (positioned over the curve - smaller to fit)
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 5, 4, 28, 28);
      }
    } catch (e) {
      console.warn("Failed to load logo:", e);
    }
  }

  // Sindicato name (positioned after curves, bold, dark red)
  // Start text at x=52 to avoid overlap with colored bars
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.red);
  doc.setFont("helvetica", "bold");
  const sindicatoName = sindicato?.razao_social?.toUpperCase() || "SINDICATO";
  // Use maxWidth to prevent text from going too far left
  const textStartX = 52;
  const maxTextWidth = pageWidth - textStartX - margin;
  doc.text(sindicatoName, textStartX, 18, { maxWidth: maxTextWidth });

  // CNPJ below title (centered)
  if (sindicato?.cnpj) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gray);
    doc.text(formatCNPJ(sindicato.cnpj), pageWidth / 2, 40, { align: "center" });
  }

  let yPos = 58;

  // ========== TITLE: FICHA DE SÓCIO ==========
  doc.setFontSize(28);
  doc.setTextColor(...COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE SÓCIO", pageWidth / 2, yPos, { align: "center" });

  yPos += 10;

  // "Filiado desde" date with badge style
  const filiadoDesde = filiacao.aprovado_at
    ? formatDate(filiacao.aprovado_at)
    : formatDate(filiacao.created_at);
  
  const badgeText = `Filiado desde ${filiadoDesde}`;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  
  // Calculate badge dimensions
  const badgeTextWidth = doc.getTextWidth(badgeText);
  const badgePadding = 8;
  const badgeWidth = badgeTextWidth + badgePadding * 2;
  const badgeHeight = 8;
  const badgeX = pageWidth / 2 - badgeWidth / 2;
  const badgeY = yPos - 5;
  
  // Draw badge background (gold/amber color)
  doc.setFillColor(180, 140, 60); // Gold color
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, "F");
  
  // Badge text (white)
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, pageWidth / 2, yPos, { align: "center" });
  
  // Reset text color
  doc.setTextColor(...COLORS.black);

  yPos += 18;

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

  // Member photo (positioned on the right side)
  const photoSize = 30; // 30x30mm photo
  const photoX = pageWidth - margin - photoSize;
  const photoY = yPos - 2;
  const photoUrl = filiacao.foto_url || filiacao.documento_foto_url;
  
  if (photoUrl) {
    try {
      const photoBase64 = await loadImageAsBase64(photoUrl);
      if (photoBase64) {
        // Draw photo border
        doc.setDrawColor(...COLORS.gray);
        doc.setLineWidth(0.5);
        doc.rect(photoX - 0.5, photoY - 0.5, photoSize + 1, photoSize + 1);
        
        // Draw photo
        doc.addImage(photoBase64, "JPEG", photoX, photoY, photoSize, photoSize);
      }
    } catch (e) {
      console.warn("Failed to load member photo:", e);
    }
  } else {
    // Draw placeholder box with initials if no photo
    doc.setDrawColor(...COLORS.gray);
    doc.setFillColor(240, 240, 240);
    doc.rect(photoX, photoY, photoSize, photoSize, "FD");
    
    // Add initials
    const initials = filiacao.nome
      .split(" ")
      .filter(n => n.length > 0)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join("");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.gray);
    doc.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 4, { align: "center" });
    doc.setTextColor(...COLORS.black);
  }

  // Grid layout for member data (matching model - 3 columns)
  // Adjust col3X to leave space for photo (30mm photo + margin)
  const col1X = margin;
  const col2X = margin + 55;
  const col3X = margin + 105; // Reduced to make room for photo
  const maxCol3X = photoX - 5; // Don't overlap with photo
  const lineHeight = 7; // Reduced line height for better spacing

  // Truncate text to fit within maxWidth (no wrapping)
  const truncateText = (text: string, maxWidth: number): string => {
    if (!text) return "";
    let truncated = text;
    while (doc.getTextWidth(truncated) > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    if (truncated.length < text.length && truncated.length > 3) {
      truncated = truncated.slice(0, -3) + "...";
    }
    return truncated;
  };

  const drawField = (label: string, value: string, x: number, y: number, maxWidth?: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.black);
    doc.text(`${label}:`, x, y);
    doc.setFont("helvetica", "normal");
    const labelWidth = doc.getTextWidth(`${label}: `);
    const displayValue = value || "";
    if (maxWidth) {
      const truncatedValue = truncateText(displayValue, maxWidth - labelWidth);
      doc.text(truncatedValue, x + labelWidth, y);
    } else {
      doc.text(displayValue, x + labelWidth, y);
    }
  };

  // Row 1 - Nome Completo (spans to col2) + Matrícula
  drawField("Nome Completo", filiacao.nome, col1X, yPos, 48);
  drawField("Matrícula", filiacao.matricula || "", col2X, yPos);
  yPos += lineHeight;

  // Row 2
  drawField("Nascimento", formatDate(filiacao.data_nascimento), col1X, yPos);
  drawField("Celular", formatPhone(filiacao.telefone), col2X, yPos);
  drawField("Telefone", "", col3X, yPos);
  yPos += lineHeight;

  // Row 3
  drawField("E-mail", filiacao.email || "", col1X, yPos, 48);
  drawField("CPF", formatCPF(filiacao.cpf), col2X, yPos);
  drawField("RG", filiacao.rg || "", col3X, yPos, maxCol3X - col3X);
  yPos += lineHeight;

  // Row 4
  const endereco = [filiacao.logradouro, filiacao.numero].filter(Boolean).join(", ");
  drawField("Endereço", endereco, col1X, yPos, 48);
  drawField("Bairro", filiacao.bairro || "", col2X, yPos, 45);
  drawField("Cidade", `${filiacao.cidade || ""} - ${filiacao.uf || ""}`, col3X, yPos, maxCol3X - col3X);
  yPos += lineHeight;

  // Row 5
  drawField("CNS", filiacao.cns || "", col1X, yPos);
  drawField("Nome da mãe", filiacao.nome_mae || "", col2X, yPos, 50);
  yPos += lineHeight;

  // Row 6
  drawField("Nome do pai", filiacao.nome_pai || "", col1X, yPos, 48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Filiado:", col3X, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(" Sim", col3X + doc.getTextWidth("Filiado: "), yPos);
  yPos += 14;

  // ========== DADOS PROFISSIONAIS SECTION ==========
  doc.setFontSize(14);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...COLORS.black);
  doc.text("Dados profissionais", margin, yPos);
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

  yPos += 10;

  // Company data (matching model layout exactly)
  drawField("Nome Empresas", filiacao.empresa_razao_social || "", col1X, yPos, 95);
  yPos += lineHeight;
  
  drawField("CNPJ", formatCNPJ(filiacao.empresa_cnpj || ""), col1X, yPos);
  drawField("Matrícula Empresa", filiacao.empresa_matricula || "", col3X, yPos);
  yPos += lineHeight;

  drawField("Segmento", filiacao.empresa_segmento || "Não Informado", col1X, yPos, 48);
  drawField("Bairro", filiacao.empresa_bairro || "", col3X, yPos);
  yPos += lineHeight;

  drawField("Endereço", filiacao.empresa_endereco || "", col1X, yPos, 95);
  drawField("Telefone", formatPhone(filiacao.empresa_telefone || ""), col3X, yPos);
  yPos += lineHeight;

  const empresaCidade = filiacao.empresa_cidade || filiacao.cidade || "";
  const empresaUf = filiacao.empresa_uf || filiacao.uf || "";
  drawField("Cidade", `${empresaCidade} - ${empresaUf}`, col1X, yPos, 48);
  drawField("Admissão", filiacao.data_admissao ? formatDate(filiacao.data_admissao) : "", col3X, yPos);
  yPos += lineHeight;

  drawField("Funções", filiacao.cargo || "", col1X, yPos, 95);
  yPos += 20;

  // ========== WATERMARK (Logo in center, faded) - Large like model ==========
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        doc.saveGraphicsState();
        // @ts-ignore - setGState exists in jsPDF
        doc.setGState(new doc.GState({ opacity: 0.15 }));
        // Large centered watermark like in the model
        const watermarkSize = 140;
        doc.addImage(
          logoBase64,
          "PNG",
          pageWidth / 2 - watermarkSize / 2,
          yPos - 50,
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
  // Calculate maximum Y position to avoid overlapping with stub area
  const stubY = pageHeight - 70; // Stub starts here
  const maxSignatureY = stubY - 20; // Leave 20pt margin before stub
  
  const cidade = sindicato?.cidade || filiacao.cidade || "";
  const dataFormatada = filiacao.aprovado_at
    ? formatDateLong(filiacao.aprovado_at)
    : formatDateLong(new Date().toISOString());

  yPos += 22;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.black);
  doc.text(`${cidade.toUpperCase()}, ${dataFormatada}`, pageWidth / 2, yPos, { align: "center" });

  // Position signature line - ensure it doesn't exceed max position
  const signatureLineY = Math.min(yPos + 40, maxSignatureY);

  // Add digital signature if exists (positioned above the line with proper spacing)
  if (filiacao.assinatura_digital_url) {
    try {
      // Check if it's a data URL (base64) or a regular URL
      let sigBase64 = filiacao.assinatura_digital_url;
      
      // If it's not already a data URL, load it
      if (!sigBase64.startsWith("data:")) {
        sigBase64 = await loadImageAsBase64(filiacao.assinatura_digital_url) || "";
      }
      
      if (sigBase64 && sigBase64.startsWith("data:image")) {
        // Position signature centered above the signature line
        // Smaller and positioned to not overlap with stub
        const sigHeight = 16;
        const sigWidth = 55;
        doc.addImage(
          sigBase64, 
          "PNG", 
          pageWidth / 2 - sigWidth / 2, 
          signatureLineY - sigHeight - 2, 
          sigWidth, 
          sigHeight
        );
      }
    } catch (e) {
      console.warn("Failed to load signature:", e);
    }
  }

  // Signature line
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - 65, signatureLineY, pageWidth / 2 + 65, signatureLineY);

  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  doc.text("Assinatura do Sócio", pageWidth / 2, signatureLineY + 6, { align: "center" });

  // ========== BOTTOM STUB (VIA EMPRESA) - Fixed position from bottom ==========

  // Dashed line separator
  doc.setDrawColor(...COLORS.gray);
  doc.setLineDashPattern([3, 2], 0);
  doc.setLineWidth(0.5);
  doc.line(margin, stubY, pageWidth - margin, stubY);
  doc.setLineDashPattern([], 0);

  // Stub content area
  const stubStartY = stubY + 6;
  const stubHeight = 55;
  
  // Draw border around stub content
  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.rect(margin, stubStartY, pageWidth - margin * 2, stubHeight - 12);

  // Row 1: Logo + Title in left section | Date/Local in middle | Checkboxes + Matrícula + Assinatura on right
  const row1Y = stubStartY + 8;

  // Small logo in stub
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

  // "Autorização de Desconto" title - positioned after logo
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.black);
  doc.text("Autorização de Desconto", margin + 20, row1Y + 4);
  
  const descontoFolha = filiacao.forma_pagamento === "desconto_folha";
  
  // Middle section - Desconto em Folha checkboxes (centered)
  const midSectionX = margin + 75;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Desconto em Folha:", midSectionX, row1Y + 2);
  
  // Sim checkbox
  doc.setLineWidth(0.3);
  doc.setDrawColor(...COLORS.black);
  doc.rect(midSectionX + 28, row1Y - 1, 3.5, 3.5);
  if (descontoFolha) {
    doc.setFillColor(...COLORS.black);
    doc.rect(midSectionX + 28.3, row1Y - 0.7, 2.9, 2.9, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.text("Sim", midSectionX + 33, row1Y + 2);

  // Não checkbox
  doc.rect(midSectionX + 42, row1Y - 1, 3.5, 3.5);
  if (!descontoFolha) {
    doc.setFillColor(...COLORS.black);
    doc.rect(midSectionX + 42.3, row1Y - 0.7, 2.9, 2.9, "F");
  }
  doc.text("Não", midSectionX + 47, row1Y + 2);

  // Right section - Vertical separator for Matrícula + Assinatura box
  const rightSectionX = pageWidth - margin - 45;
  doc.setLineWidth(0.3);
  doc.line(rightSectionX, stubStartY + 2, rightSectionX, stubStartY + stubHeight - 14);

  // Matrícula box on right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Matrícula:", rightSectionX + 3, row1Y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(filiacao.matricula || "", rightSectionX + 3, row1Y + 5);

  // Assinatura area on right - with mini signature
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Assinatura:", rightSectionX + 3, row1Y + 12);
  
  // Add mini digital signature in stub if exists
  if (filiacao.assinatura_digital_url) {
    try {
      let stubSigBase64 = filiacao.assinatura_digital_url;
      if (!stubSigBase64.startsWith("data:")) {
        stubSigBase64 = await loadImageAsBase64(filiacao.assinatura_digital_url) || "";
      }
      if (stubSigBase64 && stubSigBase64.startsWith("data:image")) {
        // Mini signature in stub (reduced size)
        doc.addImage(stubSigBase64, "PNG", rightSectionX + 3, row1Y + 14, 28, 10);
      }
    } catch (e) {
      console.warn("Failed to load stub signature:", e);
    }
  }
  
  // Signature line in stub
  doc.setLineWidth(0.2);
  doc.line(rightSectionX + 3, row1Y + 25, rightSectionX + 40, row1Y + 25);

  // Row 2: Nome completo
  const row2Y = row1Y + 12;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Nome completo:", margin + 3, row2Y);
  doc.setFont("helvetica", "normal");
  doc.text(filiacao.nome, margin + 3, row2Y + 4);

  // Row 3: Empresa onde trabalha + Table
  const row3Y = row2Y + 12;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Empresa onde trabalha:", margin + 3, row3Y);
  doc.setFont("helvetica", "normal");
  doc.text(filiacao.empresa_razao_social || "", margin + 3, row3Y + 4);

  // Table for Nº Registro, Local, Inscrição - positioned to the right of empresa
  const tableX = margin + 68;
  const cellWidth = 28;
  
  // Draw table borders
  doc.setLineWidth(0.2);
  doc.rect(tableX, row3Y - 3, cellWidth, 10);
  doc.rect(tableX + cellWidth, row3Y - 3, cellWidth, 10);
  doc.rect(tableX + cellWidth * 2, row3Y - 3, cellWidth, 10);

  // Table headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Nº Registro:", tableX + 1, row3Y);
  doc.text("Local:", tableX + cellWidth + 1, row3Y);
  doc.text("Inscrição:", tableX + cellWidth * 2 + 1, row3Y);

  // Table values
  doc.setFont("helvetica", "normal");
  doc.text("...", tableX + 1, row3Y + 4);
  doc.text((filiacao.cidade || "").toUpperCase(), tableX + cellWidth + 1, row3Y + 4);
  doc.text(formatDate(filiacao.aprovado_at || filiacao.created_at), tableX + cellWidth * 2 + 1, row3Y + 4);

  // VIA EMPRESA footer bar (red)
  const footerY = pageHeight - 8;
  doc.setFillColor(...COLORS.red);
  doc.rect(margin, footerY - 6, pageWidth - margin * 2, 10, "F");

  doc.setFontSize(11);
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
