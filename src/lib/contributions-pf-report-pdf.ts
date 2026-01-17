import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCompetence } from "./competence-format";

// Brand Colors (Eclini/SECMI)
const COLORS = {
  primary: [15, 23, 42] as [number, number, number],     // Slate-900 - Header principal
  accent: [147, 51, 234] as [number, number, number],    // Purple-600 - Accent PF
  accentLight: [192, 132, 252] as [number, number, number], // Purple-400
  warning: [245, 158, 11] as [number, number, number],   // Amber-500 - Pendente
  danger: [244, 63, 94] as [number, number, number],     // Rose-500 - Vencido
  success: [16, 185, 129] as [number, number, number],   // Emerald-500 - Pago
  muted: [100, 116, 139] as [number, number, number],    // Slate-500 - Texto secundário
  light: [248, 250, 252] as [number, number, number],    // Slate-50 - Background cards
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  // Card backgrounds
  cardTotal: [243, 232, 255] as [number, number, number],    // Purple-100
  cardPaid: [209, 250, 229] as [number, number, number],     // Emerald-100
  cardPending: [254, 243, 199] as [number, number, number],  // Amber-100
  cardOverdue: [254, 226, 226] as [number, number, number],  // Rose-100
};

interface Member {
  id: string;
  name: string;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
}

interface PFContribution {
  id: string;
  member_id?: string | null;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_value: number | null;
  payment_method?: string | null;
  patients?: Member;
  contribution_types?: ContributionType;
}

interface PFReportConfig {
  clinicName?: string;
  clinicLogo?: string;
  userName?: string;
  period: string;
  selectedMember?: Member | null;
  contributionTypeName?: string;
}

interface PFReportData {
  contributions: PFContribution[];
  summary: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    count: number;
  };
  byMemberReport?: Array<{
    member: Member;
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    count: number;
  }>;
}

export type PFReportType = 'general' | 'by-member' | 'synthetic' | 'analytical' | 'defaulting';

const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatCPF = (cpf: string | null | undefined): string => {
  if (!cpf) return "-";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    overdue: "Vencido",
    cancelled: "Cancelado",
    processing: "Processando",
    awaiting_value: "Aguardando",
    negotiated: "Negociado",
  };
  return labels[status] || status;
};

const getPaymentMethodLabel = (method: string | null | undefined): string => {
  if (!method) return "-";
  const labels: Record<string, string> = {
    pix: "PIX",
    boleto: "Boleto",
    credit_card: "Cartão",
    debit_card: "Débito",
    cash: "Dinheiro",
    transfer: "Transferência",
  };
  return labels[method] || method;
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

function addHeader(doc: jsPDF, config: PFReportConfig, title: string, logoBase64?: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Dark header background with gradient effect
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 42, "F");
  
  // Purple accent line for PF
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 42, pageWidth, 3, "F");
  
  // Logo on left (if available)
  let titleX = pageWidth / 2;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 10, 6, 30, 30);
      titleX = (pageWidth + 30) / 2;
    } catch (e) {
      console.warn("Failed to add logo to PDF:", e);
    }
  }
  
  // Title centered
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), titleX, 16, { align: "center" });
  
  // Subtitle - PF indicator
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.accentLight);
  doc.text("CONTRIBUIÇÕES PESSOA FÍSICA", titleX, 24, { align: "center" });
  
  // Institution name
  if (config.clinicName) {
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(config.clinicName, titleX, 33, { align: "center" });
  }
  
  // Period info
  doc.setFontSize(8);
  const periodText = config.contributionTypeName 
    ? `${config.period} • ${config.contributionTypeName}`
    : config.period;
  doc.text(periodText, titleX, 39, { align: "center" });
  
  // Generation date (right aligned, smaller)
  doc.setFontSize(7);
  doc.text(
    format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), 
    pageWidth - 10, 
    39, 
    { align: "right" }
  );
}

function addFooter(doc: jsPDF, config: PFReportConfig, pageNumber: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Separator line - purple for PF
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
  
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  
  // Left: Generated by
  if (config.userName) {
    doc.text(`Gerado por: ${config.userName}`, 14, pageHeight - 8);
  }
  
  // Center: Page number
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  
  // Right: Date/time
  doc.text(format(new Date(), "dd/MM/yyyy HH:mm"), pageWidth - 14, pageHeight - 8, { align: "right" });
}

function addSummaryCards(doc: jsPDF, summary: PFReportData['summary'], startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 50) / 4;
  const cardHeight = 26;
  const cardY = startY;
  
  const cards = [
    { 
      label: "TOTAL GERAL", 
      value: summary.total, 
      bgColor: COLORS.cardTotal,
      borderColor: COLORS.accent,
      textColor: COLORS.accent 
    },
    { 
      label: "RECEBIDO", 
      value: summary.paid, 
      bgColor: COLORS.cardPaid,
      borderColor: COLORS.success,
      textColor: COLORS.success 
    },
    { 
      label: "PENDENTE", 
      value: summary.pending, 
      bgColor: COLORS.cardPending,
      borderColor: COLORS.warning,
      textColor: COLORS.warning 
    },
    { 
      label: "VENCIDO", 
      value: summary.overdue, 
      bgColor: COLORS.cardOverdue,
      borderColor: COLORS.danger,
      textColor: COLORS.danger 
    },
  ];
  
  cards.forEach((card, i) => {
    const x = 14 + (i * (cardWidth + 5));
    
    // Card background
    doc.setFillColor(...card.bgColor);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "F");
    
    // Left colored border
    doc.setFillColor(...card.borderColor);
    doc.rect(x, cardY, 3, cardHeight, "F");
    
    // Label
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "bold");
    doc.text(card.label, x + 8, cardY + 8);
    
    // Value
    doc.setFontSize(13);
    doc.setTextColor(...card.textColor);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(card.value), x + 8, cardY + 19);
    doc.setFont("helvetica", "normal");
  });
  
  // Count info
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${summary.count} contribuições de sócios PF encontradas`, 14, cardY + cardHeight + 8);
  
  return cardY + cardHeight + 14;
}

function addSectionTitle(doc: jsPDF, title: string, yPos: number): number {
  doc.setFillColor(...COLORS.light);
  doc.rect(14, yPos - 4, doc.internal.pageSize.getWidth() - 28, 10, "F");
  
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.text(title, 18, yPos + 2);
  doc.setFont("helvetica", "normal");
  
  return yPos + 10;
}

// GENERAL PF REPORT
async function generatePFGeneralReport(data: PFReportData, config: PFReportConfig) {
  const doc = new jsPDF();
  const logoBase64 = config.clinicLogo ? await loadImageAsBase64(config.clinicLogo) : null;
  
  addHeader(doc, config, "Relatório Geral PF", logoBase64);
  
  let yPos = addSummaryCards(doc, data.summary, 55);
  
  // Group by status
  const statusGroups = {
    paid: data.contributions.filter(c => c.status === 'paid'),
    pending: data.contributions.filter(c => c.status === 'pending'),
    overdue: data.contributions.filter(c => c.status === 'overdue'),
  };
  
  // Status summary table
  yPos = addSectionTitle(doc, "Resumo por Status", yPos);
  
  const statusData = [
    ["✓ Pago", String(statusGroups.paid.length), formatCurrency(statusGroups.paid.reduce((s, c) => s + (c.paid_value || c.value), 0))],
    ["◷ Pendente", String(statusGroups.pending.length), formatCurrency(statusGroups.pending.reduce((s, c) => s + c.value, 0))],
    ["✗ Vencido", String(statusGroups.overdue.length), formatCurrency(statusGroups.overdue.reduce((s, c) => s + c.value, 0))],
  ];
  
  autoTable(doc, {
    startY: yPos,
    head: [["Status", "Quantidade", "Valor"]],
    body: statusData,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { 
      fillColor: COLORS.accent, 
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "left"
    },
    bodyStyles: { textColor: [51, 51, 51] },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 50, halign: "right" },
    },
  });
  
  // By member summary
  if (data.byMemberReport && data.byMemberReport.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 40;
    
    const newY = addSectionTitle(doc, "Resumo por Sócio", finalY + 10);
    
    const memberData = data.byMemberReport.slice(0, 20).map(row => [
      row.member.name.substring(0, 30),
      formatCPF(row.member.cpf),
      String(row.count),
      formatCurrency(row.total),
      formatCurrency(row.paid),
      formatCurrency(row.pending + row.overdue),
    ]);
    
    autoTable(doc, {
      startY: newY,
      head: [["Sócio", "CPF", "Qtd", "Total", "Pago", "Em Aberto"]],
      body: memberData,
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { 
        fillColor: COLORS.accent, 
        textColor: COLORS.white,
        fontStyle: "bold"
      },
      bodyStyles: { textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: COLORS.light },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 35 },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 28, halign: "right" },
      },
    });
  }
  
  addFooter(doc, config, 1, 1);
  
  doc.save(`relatorio-pf-geral-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// BY MEMBER REPORT
async function generateByMemberReport(data: PFReportData, config: PFReportConfig, member: Member) {
  const doc = new jsPDF();
  const logoBase64 = config.clinicLogo ? await loadImageAsBase64(config.clinicLogo) : null;
  
  addHeader(doc, config, "Extrato do Sócio", logoBase64);
  
  // Member info card
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(14, 52, doc.internal.pageSize.getWidth() - 28, 22, 2, 2, "F");
  
  doc.setFillColor(...COLORS.accent);
  doc.rect(14, 52, 3, 22, "F");
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(member.name, 22, 62);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(`CPF: ${formatCPF(member.cpf)}`, 22, 70);
  
  if (member.registration_number) {
    doc.text(`Matrícula: ${member.registration_number}`, 100, 70);
  }
  
  let yPos = addSummaryCards(doc, data.summary, 80);
  
  // Contribution list
  yPos = addSectionTitle(doc, "Contribuições Detalhadas", yPos);
  
  const tableData = data.contributions.map(c => [
    formatCompetence(c.competence_month, c.competence_year),
    c.contribution_types?.name || "-",
    format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy"),
    formatCurrency(c.value),
    getStatusLabel(c.status),
    c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : "-",
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [["Competência", "Tipo", "Vencimento", "Valor", "Status", "Pago em"]],
    body: tableData,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { 
      fillColor: COLORS.accent, 
      textColor: COLORS.white,
      fontStyle: "bold"
    },
    bodyStyles: { textColor: [51, 51, 51] },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 25, halign: "center" },
      5: { cellWidth: 25 },
    },
  });
  
  addFooter(doc, config, 1, 1);
  
  const safeFileName = member.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  doc.save(`extrato-socio-${safeFileName}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// SYNTHETIC PF REPORT
async function generatePFSyntheticReport(data: PFReportData, config: PFReportConfig) {
  const doc = new jsPDF();
  const logoBase64 = config.clinicLogo ? await loadImageAsBase64(config.clinicLogo) : null;
  
  addHeader(doc, config, "Relatório Sintético PF", logoBase64);
  
  let yPos = addSummaryCards(doc, data.summary, 55);
  
  // Quick stats
  yPos = addSectionTitle(doc, "Indicadores de Performance", yPos);
  
  const paidPercentage = data.summary.total > 0 
    ? ((data.summary.paid / data.summary.total) * 100).toFixed(1) 
    : "0.0";
  const pendingPercentage = data.summary.total > 0 
    ? (((data.summary.pending + data.summary.overdue) / data.summary.total) * 100).toFixed(1) 
    : "0.0";
  
  const uniqueMembers = new Set(data.contributions.map(c => c.member_id)).size;
  
  const statsData = [
    ["Total de Contribuições PF", String(data.summary.count)],
    ["Sócios Contribuintes", String(uniqueMembers)],
    ["Taxa de Recebimento", `${paidPercentage}%`],
    ["Taxa de Inadimplência", `${pendingPercentage}%`],
    ["Ticket Médio", data.summary.count > 0 ? formatCurrency(data.summary.total / data.summary.count) : "R$ 0,00"],
  ];
  
  autoTable(doc, {
    startY: yPos,
    body: statsData,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 6 },
    bodyStyles: { textColor: [51, 51, 51] },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold" },
      1: { cellWidth: 60, halign: "right" },
    },
  });
  
  // Visual indicators
  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
  
  const barWidth = 120;
  const barHeight = 12;
  const barX = 14;
  let barY = finalY + 15;
  
  // Paid bar
  doc.setFillColor(...COLORS.cardPaid);
  doc.roundedRect(barX, barY, barWidth, barHeight, 2, 2, "F");
  const paidWidth = (parseFloat(paidPercentage) / 100) * barWidth;
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(barX, barY, Math.max(paidWidth, 4), barHeight, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.primary);
  doc.text(`Recebido: ${paidPercentage}%`, barX + barWidth + 5, barY + 8);
  
  barY += 18;
  
  // Pending bar
  doc.setFillColor(...COLORS.cardOverdue);
  doc.roundedRect(barX, barY, barWidth, barHeight, 2, 2, "F");
  const pendingWidth = (parseFloat(pendingPercentage) / 100) * barWidth;
  doc.setFillColor(...COLORS.danger);
  doc.roundedRect(barX, barY, Math.max(pendingWidth, 4), barHeight, 2, 2, "F");
  doc.text(`Inadimplência: ${pendingPercentage}%`, barX + barWidth + 5, barY + 8);
  
  addFooter(doc, config, 1, 1);
  
  doc.save(`relatorio-pf-sintetico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ANALYTICAL PF REPORT
async function generatePFAnalyticalReport(data: PFReportData, config: PFReportConfig) {
  const doc = new jsPDF("landscape");
  const logoBase64 = config.clinicLogo ? await loadImageAsBase64(config.clinicLogo) : null;
  
  addHeader(doc, config, "Relatório Analítico PF", logoBase64);
  
  // Full contribution list
  const tableData = data.contributions.map((c, i) => [
    String(i + 1),
    c.patients?.name?.substring(0, 25) || "-",
    formatCPF(c.patients?.cpf || ""),
    formatCompetence(c.competence_month, c.competence_year),
    c.contribution_types?.name?.substring(0, 18) || "-",
    format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy"),
    formatCurrency(c.value),
    getStatusLabel(c.status),
    c.paid_at ? format(new Date(c.paid_at), "dd/MM/yy") : "-",
    getPaymentMethodLabel(c.payment_method),
  ]);
  
  autoTable(doc, {
    startY: 55,
    head: [["#", "Sócio", "CPF", "Comp.", "Tipo", "Vencimento", "Valor", "Status", "Pago em", "Forma"]],
    body: tableData,
    theme: "plain",
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { 
      fillColor: COLORS.accent, 
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 8
    },
    bodyStyles: { textColor: [51, 51, 51] },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 45 },
      2: { cellWidth: 32 },
      3: { cellWidth: 22 },
      4: { cellWidth: 32 },
      5: { cellWidth: 22 },
      6: { cellWidth: 25, halign: "right" },
      7: { cellWidth: 20, halign: "center" },
      8: { cellWidth: 22 },
      9: { cellWidth: 25 },
    },
    didDrawPage: (tableData) => {
      addFooter(doc, config, tableData.pageNumber, doc.getNumberOfPages());
    },
  });
  
  // Summary at end
  const finalY = (doc as any).lastAutoTable?.finalY || 55;
  if (finalY < 170) {
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(14, finalY + 5, doc.internal.pageSize.getWidth() - 28, 12, 2, 2, "F");
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.accent);
    doc.text(
      `Total: ${formatCurrency(data.summary.total)} | Pago: ${formatCurrency(data.summary.paid)} | Pendente: ${formatCurrency(data.summary.pending)} | Vencido: ${formatCurrency(data.summary.overdue)}`, 
      20, 
      finalY + 12
    );
  }
  
  doc.save(`relatorio-pf-analitico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// DEFAULTING PF REPORT
async function generatePFDefaultingReport(data: PFReportData, config: PFReportConfig) {
  const doc = new jsPDF();
  const logoBase64 = config.clinicLogo ? await loadImageAsBase64(config.clinicLogo) : null;
  
  addHeader(doc, config, "Inadimplência PF", logoBase64);
  
  // Filter only pending and overdue
  const defaultingContributions = data.contributions.filter(
    c => c.status === 'pending' || c.status === 'overdue'
  );
  
  // Group by member
  const byMember = new Map<string, {
    member: Member;
    contributions: PFContribution[];
    total: number;
    pending: number;
    overdue: number;
  }>();
  
  defaultingContributions.forEach(c => {
    if (!c.patients) return;
    const existing = byMember.get(c.member_id) || {
      member: c.patients,
      contributions: [],
      total: 0,
      pending: 0,
      overdue: 0,
    };
    existing.contributions.push(c);
    existing.total += c.value;
    if (c.status === 'pending') existing.pending += c.value;
    if (c.status === 'overdue') existing.overdue += c.value;
    byMember.set(c.member_id, existing);
  });
  
  const sortedMembers = Array.from(byMember.values()).sort((a, b) => b.total - a.total);
  
  // Summary card
  const totalPending = defaultingContributions.filter(c => c.status === 'pending').reduce((s, c) => s + c.value, 0);
  const totalOverdue = defaultingContributions.filter(c => c.status === 'overdue').reduce((s, c) => s + c.value, 0);
  const totalDefaulting = totalPending + totalOverdue;
  
  // Alert banner
  doc.setFillColor(...COLORS.cardOverdue);
  doc.roundedRect(14, 52, doc.internal.pageSize.getWidth() - 28, 24, 2, 2, "F");
  
  doc.setFillColor(...COLORS.danger);
  doc.rect(14, 52, 4, 24, "F");
  
  doc.setTextColor(...COLORS.danger);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Total em Aberto: ${formatCurrency(totalDefaulting)}`, 24, 62);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Pendente: ${formatCurrency(totalPending)} | Vencido: ${formatCurrency(totalOverdue)} | ${sortedMembers.length} sócio(s) | ${defaultingContributions.length} contribuição(ões)`, 
    24, 
    72
  );
  
  // Table by member
  const yPos = addSectionTitle(doc, "Sócios Inadimplentes", 84);
  
  const tableData = sortedMembers.map(row => [
    row.member.name.substring(0, 30),
    formatCPF(row.member.cpf),
    String(row.contributions.length),
    formatCurrency(row.pending),
    formatCurrency(row.overdue),
    formatCurrency(row.total),
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [["Sócio", "CPF", "Qtd", "Pendente", "Vencido", "Total"]],
    body: tableData,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { 
      fillColor: COLORS.danger, 
      textColor: COLORS.white,
      fontStyle: "bold"
    },
    bodyStyles: { textColor: [51, 51, 51] },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 35 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
    foot: [["TOTAL", "", String(defaultingContributions.length), formatCurrency(totalPending), formatCurrency(totalOverdue), formatCurrency(totalDefaulting)]],
    footStyles: { 
      fillColor: COLORS.cardOverdue, 
      textColor: COLORS.danger, 
      fontStyle: "bold" 
    },
  });
  
  addFooter(doc, config, 1, 1);
  
  doc.save(`relatorio-pf-inadimplencia-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// Main export function
export async function generatePFContributionsReport(
  type: PFReportType,
  data: PFReportData,
  config: PFReportConfig
) {
  switch (type) {
    case 'general':
      await generatePFGeneralReport(data, config);
      break;
    case 'by-member':
      if (config.selectedMember) {
        await generateByMemberReport(data, config, config.selectedMember);
      } else {
        await generatePFGeneralReport(data, config);
      }
      break;
    case 'synthetic':
      await generatePFSyntheticReport(data, config);
      break;
    case 'analytical':
      await generatePFAnalyticalReport(data, config);
      break;
    case 'defaulting':
      await generatePFDefaultingReport(data, config);
      break;
    default:
      await generatePFGeneralReport(data, config);
  }
}
