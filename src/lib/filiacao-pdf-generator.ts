import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Brand Colors matching the model
const COLORS = {
  red: [139, 0, 0] as [number, number, number], // Dark red for header bar
  gold: [218, 165, 32] as [number, number, number], // Gold accent line
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

  // ========== HEADER WITH RED BAR AND GOLD ACCENT ==========
  // Draw red gradient bar at top
  doc.setFillColor(...COLORS.red);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Gold accent line below
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 28, pageWidth, 3, "F");

  // Logo on left
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 8, 3, 22, 22);
      }
    } catch (e) {
      console.warn("Failed to load logo:", e);
    }
  }

  // Sindicato name in header (white text, centered)
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  const sindicatoName = sindicato?.razao_social?.toUpperCase() || "SINDICATO";
  doc.text(sindicatoName, pageWidth / 2, 14, { align: "center" });

  // CNPJ below (smaller, white)
  if (sindicato?.cnpj) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(sindicato.cnpj, pageWidth / 2, 22, { align: "center" });
  }

  let yPos = 40;

  // ========== TITLE: FICHA DE SÓCIO ==========
  doc.setFontSize(22);
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
  doc.text(`Filiado desde ${filiadoDesde}`, pageWidth / 2, yPos, { align: "center" });

  yPos += 14;

  // ========== DADOS DO SÓCIO SECTION ==========
  doc.setFontSize(13);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...COLORS.black);
  doc.text("Dados do Sócio", margin, yPos);

  // Underline
  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

  yPos += 10;

  // Grid layout for member data (3 columns)
  const col1X = margin;
  const col2X = margin + 62;
  const col3X = margin + 124;
  const lineHeight = 6;

  const drawField = (label: string, value: string, x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${label}:`, x, y);
    doc.setFont("helvetica", "normal");
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.text(value || "", x + labelWidth, y);
  };

  // Row 1
  drawField("Nome Completo", filiacao.nome, col1X, yPos);
  yPos += lineHeight;

  // Row 2 (spread across columns)
  drawField("Nascimento", formatDate(filiacao.data_nascimento), col1X, yPos);
  drawField("Matrícula", filiacao.matricula || "", col2X, yPos);
  drawField("Telefone", formatPhone(filiacao.telefone) || "", col3X, yPos);
  yPos += lineHeight;

  // Row 3
  drawField("E-mail", filiacao.email || "", col1X, yPos);
  drawField("Celular", formatPhone(filiacao.telefone), col2X, yPos);
  drawField("RG", filiacao.rg || "", col3X, yPos);
  yPos += lineHeight;

  // Row 4
  const endereco = [filiacao.logradouro, filiacao.numero].filter(Boolean).join(", ");
  drawField("Endereço", endereco, col1X, yPos);
  drawField("CPF", formatCPF(filiacao.cpf), col2X, yPos);
  drawField("Cidade", `${filiacao.cidade || ""} - ${filiacao.uf || ""}`, col3X, yPos);
  yPos += lineHeight;

  // Row 5
  drawField("CNS", (filiacao as any).cns || "", col1X, yPos);
  drawField("Bairro", filiacao.bairro || "", col2X, yPos);
  drawField("Nome do pai", filiacao.nome_pai || "", col3X, yPos);
  yPos += lineHeight;

  // Row 6
  drawField("Nome da mãe", filiacao.nome_mae || "", col2X, yPos);
  doc.setFont("helvetica", "bold");
  doc.text("Filiado:", col3X, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(" Sim", col3X + doc.getTextWidth("Filiado: "), yPos);
  yPos += 12;

  // ========== DADOS PROFISSIONAIS SECTION ==========
  doc.setFontSize(13);
  doc.setFont("helvetica", "bolditalic");
  doc.text("Dados profissionais", margin, yPos);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

  yPos += 10;

  // Company data
  drawField("Nome Empresas", filiacao.empresa_razao_social || "", col1X, yPos);
  yPos += lineHeight;

  drawField("Segmento", (filiacao as any).empresa_segmento || "Comércio Varejista", col1X, yPos);
  drawField("Bairro", (filiacao as any).empresa_bairro || filiacao.bairro || "", col3X, yPos);
  yPos += lineHeight;

  drawField("Endereço", (filiacao as any).empresa_endereco || "", col1X, yPos);
  drawField("Telefone", (filiacao as any).empresa_telefone || "", col3X, yPos);
  yPos += lineHeight;

  const empresaCidade = (filiacao as any).empresa_cidade || filiacao.cidade || "";
  const empresaUf = (filiacao as any).empresa_uf || filiacao.uf || "";
  drawField("Cidade", `${empresaCidade} - ${empresaUf}`, col1X, yPos);
  drawField("Admissão", filiacao.data_admissao ? formatDate(filiacao.data_admissao) : "Não informado", col3X, yPos);
  yPos += lineHeight;

  drawField("Funções", filiacao.cargo || "", col1X, yPos);
  yPos += 20;

  // ========== WATERMARK (Logo in center, faded) ==========
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        // Draw semi-transparent logo in the center background
        doc.saveGraphicsState();
        // @ts-ignore - setGState exists in jsPDF
        doc.setGState(new doc.GState({ opacity: 0.15 }));
        doc.addImage(logoBase64, "PNG", pageWidth / 2 - 50, yPos - 20, 100, 100);
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

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${cidade.toUpperCase()}, ${dataFormatada}`, pageWidth / 2, yPos + 50, { align: "center" });

  yPos += 75;

  // Signature line
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2 - 50, yPos, pageWidth / 2 + 50, yPos);

  doc.setFontSize(10);
  doc.text("Assinatura do Sócio", pageWidth / 2, yPos + 6, { align: "center" });

  // Add digital signature if exists
  if (filiacao.assinatura_digital_url) {
    try {
      const sigBase64 = await loadImageAsBase64(filiacao.assinatura_digital_url);
      if (sigBase64) {
        doc.addImage(sigBase64, "PNG", pageWidth / 2 - 30, yPos - 25, 60, 20);
      }
    } catch (e) {
      console.warn("Failed to load signature:", e);
    }
  }

  // ========== BOTTOM STUB (VIA EMPRESA) ==========
  const stubY = pageHeight - 55;

  // Dashed line separator
  doc.setDrawColor(...COLORS.gray);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, stubY, pageWidth - margin, stubY);
  doc.setLineDashPattern([], 0);

  const stubStartY = stubY + 8;

  // Small logo on left
  if (sindicato?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(sindicato.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", margin, stubStartY - 2, 12, 12);
      }
    } catch (e) {
      console.warn("Failed to load stub logo:", e);
    }
  }

  // "Autorização de Desconto" title
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Autorização de Desconto", margin + 16, stubStartY + 4);

  // Desconto em Folha checkbox
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const descontoFolha = filiacao.forma_pagamento === "desconto_folha";
  doc.text("Desconto em Folha:", margin + 75, stubStartY + 4);

  // Sim checkbox
  doc.rect(margin + 115, stubStartY, 4, 4);
  if (descontoFolha) {
    doc.setFillColor(...COLORS.black);
    doc.rect(margin + 115.5, stubStartY + 0.5, 3, 3, "F");
  }
  doc.text("Sim", margin + 121, stubStartY + 4);

  // Não checkbox
  doc.rect(margin + 135, stubStartY, 4, 4);
  if (!descontoFolha) {
    doc.setFillColor(...COLORS.black);
    doc.rect(margin + 135.5, stubStartY + 0.5, 3, 3, "F");
  }
  doc.text("Não", margin + 141, stubStartY + 4);

  // Matrícula on right
  doc.setFont("helvetica", "bold");
  doc.text("Matrícula:", pageWidth - margin - 35, stubStartY);
  doc.setFont("helvetica", "normal");
  doc.text(filiacao.matricula || "", pageWidth - margin - 35, stubStartY + 6);

  // Second row
  const row2Y = stubStartY + 12;

  // Nome completo
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Nome completo:", margin, row2Y);
  doc.setFont("helvetica", "normal");
  doc.text(filiacao.nome, margin, row2Y + 4);

  // Assinatura on right
  doc.setFont("helvetica", "bold");
  doc.text("Assinatura:", pageWidth - margin - 35, row2Y);
  doc.line(pageWidth - margin - 35, row2Y + 8, pageWidth - margin, row2Y + 8);

  // Third row - company info
  const row3Y = row2Y + 14;

  doc.setFont("helvetica", "bold");
  doc.text("Empresa onde trabalha:", margin, row3Y);
  doc.setFont("helvetica", "normal");
  doc.text(filiacao.empresa_razao_social || "", margin, row3Y + 4);

  // Nº Registro, Local, Inscrição table
  const tableStartX = margin + 60;
  doc.setFont("helvetica", "bold");
  doc.text("Nº Registro:", tableStartX, row3Y);
  doc.setFont("helvetica", "normal");
  doc.text("...", tableStartX, row3Y + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Local:", tableStartX + 35, row3Y);
  doc.setFont("helvetica", "normal");
  doc.text(filiacao.cidade?.toUpperCase() || "", tableStartX + 35, row3Y + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Inscrição:", tableStartX + 70, row3Y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(filiacao.aprovado_at || filiacao.created_at), tableStartX + 70, row3Y + 4);

  // VIA EMPRESA footer bar
  const footerY = pageHeight - 8;
  doc.setFillColor(...COLORS.red);
  doc.rect(margin, footerY - 5, pageWidth - margin * 2, 8, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("VIA EMPRESA", pageWidth / 2, footerY, { align: "center" });

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
