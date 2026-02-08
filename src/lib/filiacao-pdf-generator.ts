import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

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
  // Company fields - matching actual database columns
  empresa?: string | null; // legacy field
  empresa_razao_social?: string | null;
  empresa_nome_fantasia?: string | null;
  empresa_cnpj?: string | null;
  empresa_matricula?: string | null;
  empresa_endereco?: string | null;
  // These may not exist in DB but could be passed from linked employer
  empresa_segmento?: string | null;
  empresa_bairro?: string | null;
  empresa_cidade?: string | null;
  empresa_uf?: string | null;
  empresa_telefone?: string | null;
  forma_pagamento?: string | null;
  assinatura_digital_url?: string | null;
  assinatura_aceite_desconto?: boolean | null;
  assinatura_aceite_at?: string | null;
  matricula?: string | null;
  created_at: string;
  aprovado_at?: string | null;
  cns?: string | null;
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

function describeImageInput(input: unknown): "none" | "dataurl" | "blob" | "http" | "path" {
  if (!input || typeof input !== "string") return "none";
  if (input.startsWith("data:image/")) return "dataurl";
  if (input.startsWith("blob:")) return "blob";
  if (input.startsWith("http")) return "http";
  return "path";
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) throw new Error("DATA_URL_INVALIDA");
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  return { mime, bytes: decodeBase64ToBytes(base64) };
}

function getPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

function requireEmbeddedDataUrl(label: string, input: string | null | undefined) {
  if (!input) throw new Error(`${label}_AUSENTE`);
  if (input.startsWith("blob:")) throw new Error(`${label}_BLOB_URL_PROIBIDA`);
  if (!input.startsWith("data:image/")) {
    throw new Error(`${label}_NAO_EMBUTIDA: esperado data:image/*;base64,...`);
  }

  const { mime, bytes } = dataUrlToBytes(input);
  const dims = mime === "image/png" ? getPngDimensions(bytes) : null;

  return {
    dataUrl: input,
    mime,
    bytes: bytes.byteLength,
    pngDims: dims,
  };
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;

  // Blob URLs are local-only and PROIBIDAS
  if (url.startsWith("blob:")) {
    throw new Error("BLOB_URL_PROIBIDA");
  }

  if (url.startsWith("data:image/")) return url;

  // Prefer backend function to avoid CORS issues (and support more hosts)
  try {
    const { data, error } = await supabase.functions.invoke("fetch-image-base64", {
      body: { url },
    });

    if (!error && data?.base64) {
      if (typeof data.base64 === "string" && data.base64.startsWith("data:image/")) {
        return data.base64;
      }
      if (data.contentType) {
        return `data:${data.contentType};base64,${data.base64}`;
      }
      // Fallback (best-effort)
      return `data:image/png;base64,${data.base64}`;
    }
  } catch (err) {
    console.warn("[FiliacaoPDF][generator] loadImageAsBase64 via function failed", err);
  }

  // Fallback to direct fetch
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getPdfImageFormat(dataUrl: string): "PNG" | "JPEG" {
  const match = dataUrl.match(/^data:image\/(png|jpe?g)/i);
  if (!match) return "PNG";
  return match[1].toLowerCase() === "png" ? "PNG" : "JPEG";
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
        doc.addImage(logoBase64, getPdfImageFormat(logoBase64), 5, 4, 28, 28);
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

  // AUDIT: payload snapshot (do not silence)
  console.log("[FiliacaoPDF][generator] payload", {
    cpf: filiacao.cpf,
    foto_url_type: describeImageInput(filiacao.foto_url),
    documento_foto_url_type: describeImageInput(filiacao.documento_foto_url),
    assinatura_digital_url_type: describeImageInput(filiacao.assinatura_digital_url),
  });

  // STRICT: photo must be embedded as data URL
  const photoAudit = requireEmbeddedDataUrl("FOTO", photoUrl);
  console.log("[FiliacaoPDF][generator] FOTO", {
    mime: photoAudit.mime,
    bytes: photoAudit.bytes,
    pngDims: photoAudit.pngDims,
  });

  // Draw photo border
  doc.setDrawColor(...COLORS.gray);
  doc.setLineWidth(0.5);
  doc.rect(photoX - 0.5, photoY - 0.5, photoSize + 1, photoSize + 1);

  // Draw photo
  doc.addImage(photoAudit.dataUrl, getPdfImageFormat(photoAudit.dataUrl), photoX, photoY, photoSize, photoSize);

  // Grid layout for member data (matching model - 3 columns)
  // Adjust col3X to leave space for photo (30mm photo + margin)
  const col1X = margin;
  const col2X = margin + 60;
  const col3X = margin + 115; // Positioned to not overlap with photo
  const maxCol3X = photoX - 8; // Safe distance from photo
  const lineHeight = 8; // Increased line height to prevent overlap

  // Calculate available width for each column
  const col1Width = col2X - col1X - 4;
  const col2Width = col3X - col2X - 4;
  const col3Width = maxCol3X - col3X;

  // Truncate text to fit within maxWidth (no wrapping)
  const truncateText = (text: string, maxWidth: number): string => {
    if (!text) return "";
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    let truncated = text;
    while (doc.getTextWidth(truncated) > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    if (truncated.length < text.length) {
      // Remove 3 more chars to add ellipsis
      truncated = truncated.slice(0, Math.max(0, truncated.length - 3)) + "...";
    }
    return truncated;
  };

  const drawField = (label: string, value: string, x: number, y: number, maxWidth?: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.black);
    const labelText = `${label}:`;
    doc.text(labelText, x, y);
    
    doc.setFont("helvetica", "normal");
    const labelWidth = doc.getTextWidth(labelText) + 2;
    const displayValue = value || "";
    
    const availableWidth = maxWidth ? (maxWidth - labelWidth) : 50;
    const truncatedValue = truncateText(displayValue, availableWidth);
    doc.text(truncatedValue, x + labelWidth, y);
  };

  // Row 1 - Nome Completo + Matrícula
  drawField("Nome", filiacao.nome, col1X, yPos, col1Width);
  drawField("Matrícula", filiacao.matricula || "", col2X, yPos, col2Width);
  yPos += lineHeight;

  // Row 2
  drawField("Nascimento", formatDate(filiacao.data_nascimento), col1X, yPos, col1Width);
  drawField("Celular", formatPhone(filiacao.telefone), col2X, yPos, col2Width);
  yPos += lineHeight;

  // Row 3
  drawField("E-mail", filiacao.email || "", col1X, yPos, col1Width);
  drawField("CPF", formatCPF(filiacao.cpf), col2X, yPos, col2Width);
  drawField("RG", filiacao.rg || "", col3X, yPos, col3Width);
  yPos += lineHeight;

  // Row 4
  const endereco = [filiacao.logradouro, filiacao.numero].filter(Boolean).join(", ");
  drawField("Endereço", endereco, col1X, yPos, col1Width);
  drawField("Bairro", filiacao.bairro || "", col2X, yPos, col2Width);
  drawField("Cidade", `${filiacao.cidade || ""} - ${filiacao.uf || ""}`, col3X, yPos, col3Width);
  yPos += lineHeight;

  // Row 5
  drawField("CNS", filiacao.cns || "", col1X, yPos, col1Width);
  drawField("Nome Mãe", filiacao.nome_mae || "", col2X, yPos, col2Width + col3Width);
  yPos += lineHeight;

  // Row 6
  drawField("Nome Pai", filiacao.nome_pai || "", col1X, yPos, col1Width);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Filiado: Sim", col2X, yPos);
  yPos += 14;

  // ========== DADOS PROFISSIONAIS SECTION ==========
  doc.setFontSize(14);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...COLORS.black);
  doc.text("Dados profissionais", margin, yPos);
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

  yPos += 10;

  // Company data layout - use same columns as personal data
  // Use fallbacks: empresa_razao_social > empresa_nome_fantasia > empresa
  const profCol1Width = 90;
  const profCol2X = col1X + 95;
  const profCol2Width = pageWidth - margin - profCol2X;

  const empresaNome = filiacao.empresa_razao_social || filiacao.empresa_nome_fantasia || filiacao.empresa || "";
  drawField("Empresa", empresaNome, col1X, yPos, profCol1Width);
  yPos += lineHeight;
  
  drawField("CNPJ", formatCNPJ(filiacao.empresa_cnpj || ""), col1X, yPos, profCol1Width);
  drawField("Matr. Empresa", filiacao.empresa_matricula || "", profCol2X, yPos, profCol2Width);
  yPos += lineHeight;

  // Endereço da empresa (pode incluir segmento se existir)
  const enderecoEmpresa = filiacao.empresa_endereco || "";
  drawField("Endereço", enderecoEmpresa, col1X, yPos, profCol1Width);
  // Segmento é opcional - só mostra se existir
  if (filiacao.empresa_segmento) {
    drawField("Segmento", filiacao.empresa_segmento, profCol2X, yPos, profCol2Width);
  }
  yPos += lineHeight;

  // Cidade/UF e Telefone
  const empresaCidade = filiacao.empresa_cidade || filiacao.cidade || "";
  const empresaUf = filiacao.empresa_uf || filiacao.uf || "";
  const cidadeUfText = empresaCidade && empresaUf ? `${empresaCidade} - ${empresaUf}` : empresaCidade || empresaUf;
  drawField("Cidade", cidadeUfText, col1X, yPos, profCol1Width);
  if (filiacao.empresa_telefone) {
    drawField("Telefone", formatPhone(filiacao.empresa_telefone), profCol2X, yPos, profCol2Width);
  }
  yPos += lineHeight;

  drawField("Admissão", filiacao.data_admissao ? formatDate(filiacao.data_admissao) : "", col1X, yPos, profCol1Width);
  drawField("Função/Cargo", filiacao.cargo || "", profCol2X, yPos, profCol2Width);
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
  const maxDateY = stubY - 55; // Date must be at least 55pt above stub
  
  const cidade = sindicato?.cidade || filiacao.cidade || "";
  const dataFormatada = filiacao.aprovado_at
    ? formatDateLong(filiacao.aprovado_at)
    : formatDateLong(new Date().toISOString());

  // Cap yPos to ensure date doesn't overlap with stub
  yPos = Math.min(yPos + 8, maxDateY);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.black);
  doc.text(`${cidade.toUpperCase()}, ${dataFormatada}`, pageWidth / 2, yPos, { align: "center" });

  // Position signature line - ensure it doesn't exceed max position
  const maxSignatureY = stubY - 12;
  const signatureLineY = Math.min(yPos + 35, maxSignatureY);

  // Add digital signature if exists (positioned above the line with proper spacing)
  if (filiacao.assinatura_digital_url) {
    const sigAudit = requireEmbeddedDataUrl("ASSINATURA", filiacao.assinatura_digital_url);

    // Extra guard against blank PNG signatures (1x1)
    if (sigAudit.mime === "image/png" && sigAudit.pngDims && (sigAudit.pngDims.width <= 2 || sigAudit.pngDims.height <= 2)) {
      throw new Error(`ASSINATURA_INVALIDA_PNG_${sigAudit.pngDims.width}x${sigAudit.pngDims.height}`);
    }

    console.log("[FiliacaoPDF][generator] ASSINATURA", {
      mime: sigAudit.mime,
      bytes: sigAudit.bytes,
      pngDims: sigAudit.pngDims,
    });

    // Position signature centered above the signature line
    const sigHeight = 16;
    const sigWidth = 55;
    doc.addImage(
      sigAudit.dataUrl,
      getPdfImageFormat(sigAudit.dataUrl),
      pageWidth / 2 - sigWidth / 2,
      signatureLineY - sigHeight - 2,
      sigWidth,
      sigHeight
    );
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
        doc.addImage(logoBase64, getPdfImageFormat(logoBase64), margin + 3, row1Y - 4, 14, 14);
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
    const stubSigAudit = requireEmbeddedDataUrl("ASSINATURA_STUB", filiacao.assinatura_digital_url);

    if (
      stubSigAudit.mime === "image/png" &&
      stubSigAudit.pngDims &&
      (stubSigAudit.pngDims.width <= 2 || stubSigAudit.pngDims.height <= 2)
    ) {
      throw new Error(`ASSINATURA_STUB_INVALIDA_PNG_${stubSigAudit.pngDims.width}x${stubSigAudit.pngDims.height}`);
    }

    console.log("[FiliacaoPDF][generator] ASSINATURA_STUB", {
      mime: stubSigAudit.mime,
      bytes: stubSigAudit.bytes,
      pngDims: stubSigAudit.pngDims,
    });

    // Mini signature in stub (reduced size)
    doc.addImage(
      stubSigAudit.dataUrl,
      getPdfImageFormat(stubSigAudit.dataUrl),
      rightSectionX + 3,
      row1Y + 14,
      28,
      10
    );
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

  // Row 3: Empresa onde trabalha + CNPJ + Endereço
  const row3Y = row2Y + 12;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Empresa:", margin + 3, row3Y);
  doc.setFont("helvetica", "normal");
  // Truncate company name if too long
  const empresaNomeStub = (filiacao.empresa_razao_social || "").substring(0, 35);
  doc.text(empresaNomeStub, margin + 3, row3Y + 4);
  
  // CNPJ da empresa
  doc.setFont("helvetica", "bold");
  doc.text("CNPJ:", margin + 3, row3Y + 9);
  doc.setFont("helvetica", "normal");
  doc.text(formatCNPJ(filiacao.empresa_cnpj || ""), margin + 14, row3Y + 9);
  
  // Endereço da empresa (simplified)
  const enderecoEmpresaStub = [
    filiacao.empresa_endereco,
    filiacao.empresa_bairro,
    filiacao.empresa_cidade ? `${filiacao.empresa_cidade}-${filiacao.empresa_uf || ""}` : ""
  ].filter(Boolean).join(", ").substring(0, 50);
  if (enderecoEmpresaStub) {
    doc.setFont("helvetica", "bold");
    doc.text("End:", margin + 50, row3Y + 9);
    doc.setFont("helvetica", "normal");
    doc.text(enderecoEmpresaStub, margin + 60, row3Y + 9);
  }

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
