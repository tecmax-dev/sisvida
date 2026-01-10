import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
}

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_value: number | null;
  payment_method?: string | null;
  employers?: Employer;
  contribution_types?: ContributionType;
}

interface ReportConfig {
  clinicName?: string;
  clinicLogo?: string;
  userName?: string;
  period: string;
  selectedEmployer?: Employer | null;
}

interface ReportData {
  contributions: Contribution[];
  summary: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    count: number;
  };
  byEmployerReport?: Array<{
    employer: Employer;
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    count: number;
  }>;
}

type ReportType = 'general' | 'by-employer' | 'synthetic' | 'analytical' | 'defaulting';

const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatCNPJ = (cnpj: string): string => {
  if (!cnpj) return "-";
  const cleaned = cnpj.replace(/\D/g, "");
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
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

function addHeader(doc: jsPDF, config: ReportConfig, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Dark header background
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  // Title
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 15, { align: "center" });
  
  // Institution name
  if (config.clinicName) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(config.clinicName, pageWidth / 2, 23, { align: "center" });
  }
  
  // Period
  doc.setFontSize(10);
  doc.text(`Período: ${config.period}`, pageWidth / 2, 31, { align: "center" });
  
  // Generation date (right aligned)
  doc.setFontSize(8);
  doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - 14, 37, { align: "right" });
}

function addFooter(doc: jsPDF, config: ReportConfig, pageNumber: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  // User name
  if (config.userName) {
    doc.text(`Gerado por: ${config.userName}`, 14, pageHeight - 10);
  }
  
  // Page number
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
  
  // Date/time
  doc.text(format(new Date(), "dd/MM/yyyy HH:mm"), pageWidth - 14, pageHeight - 10, { align: "right" });
}

function addSummaryCards(doc: jsPDF, summary: ReportData['summary'], startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 42) / 4;
  const cardHeight = 20;
  const cardY = startY;
  
  const cards = [
    { label: "Total Geral", value: summary.total, color: [15, 23, 42] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] },
    { label: "Recebido", value: summary.paid, color: [16, 185, 129] as [number, number, number], textColor: [16, 185, 129] as [number, number, number] },
    { label: "Pendente", value: summary.pending, color: [245, 158, 11] as [number, number, number], textColor: [245, 158, 11] as [number, number, number] },
    { label: "Vencido", value: summary.overdue, color: [244, 63, 94] as [number, number, number], textColor: [244, 63, 94] as [number, number, number] },
  ];
  
  cards.forEach((card, i) => {
    const x = 14 + (i * (cardWidth + 4));
    
    // Card border
    doc.setDrawColor(...card.color);
    doc.setLineWidth(0.5);
    doc.rect(x, cardY, cardWidth, cardHeight);
    
    // Label
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(card.label, x + 3, cardY + 6);
    
    // Value
    doc.setFontSize(12);
    doc.setTextColor(...card.textColor);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(card.value), x + 3, cardY + 14);
    doc.setFont("helvetica", "normal");
  });
  
  // Count
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`${summary.count} contribuições`, 14, cardY + cardHeight + 6);
  
  return cardY + cardHeight + 12;
}

// GENERAL REPORT - Consolidated view of all companies
export function generateGeneralReport(data: ReportData, config: ReportConfig) {
  const doc = new jsPDF();
  
  addHeader(doc, config, "Relatório Geral de Contribuições");
  
  let yPos = addSummaryCards(doc, data.summary, 50);
  
  // Group by status
  const statusGroups = {
    paid: data.contributions.filter(c => c.status === 'paid'),
    pending: data.contributions.filter(c => c.status === 'pending'),
    overdue: data.contributions.filter(c => c.status === 'overdue'),
  };
  
  // Status summary table
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo por Status", 14, yPos);
  doc.setFont("helvetica", "normal");
  
  const statusData = [
    ["Pago", String(statusGroups.paid.length), formatCurrency(statusGroups.paid.reduce((s, c) => s + (c.paid_value || c.value), 0))],
    ["Pendente", String(statusGroups.pending.length), formatCurrency(statusGroups.pending.reduce((s, c) => s + c.value, 0))],
    ["Vencido", String(statusGroups.overdue.length), formatCurrency(statusGroups.overdue.reduce((s, c) => s + c.value, 0))],
  ];
  
  autoTable(doc, {
    startY: yPos + 5,
    head: [["Status", "Quantidade", "Valor"]],
    body: statusData,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 50, halign: "right" },
    },
  });
  
  // By employer summary
  if (data.byEmployerReport && data.byEmployerReport.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 40;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo por Empresa", 14, finalY + 15);
    doc.setFont("helvetica", "normal");
    
    const employerData = data.byEmployerReport.slice(0, 20).map(row => [
      row.employer.name.substring(0, 35),
      formatCNPJ(row.employer.cnpj),
      String(row.count),
      formatCurrency(row.total),
      formatCurrency(row.paid),
      formatCurrency(row.pending + row.overdue),
    ]);
    
    autoTable(doc, {
      startY: finalY + 20,
      head: [["Empresa", "CNPJ", "Qtd", "Total", "Pago", "A Receber"]],
      body: employerData,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
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
  
  doc.save(`relatorio-geral-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// BY EMPLOYER REPORT - Detailed single employer view
export function generateByEmployerReport(data: ReportData, config: ReportConfig, employer: Employer) {
  const doc = new jsPDF();
  
  addHeader(doc, config, "Relatório Individual - Empresa");
  
  // Employer info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(employer.name, 14, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`CNPJ: ${formatCNPJ(employer.cnpj)}`, 14, 59);
  if (employer.registration_number) {
    doc.text(`Matrícula: ${employer.registration_number}`, 14, 65);
  }
  
  let yPos = addSummaryCards(doc, data.summary, employer.registration_number ? 72 : 66);
  
  // Contribution list
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Contribuições", 14, yPos);
  doc.setFont("helvetica", "normal");
  
  const tableData = data.contributions.map(c => [
    `${MONTHS[c.competence_month - 1]}/${c.competence_year}`,
    c.contribution_types?.name || "-",
    format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy"),
    formatCurrency(c.value),
    getStatusLabel(c.status),
    c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : "-",
  ]);
  
  autoTable(doc, {
    startY: yPos + 5,
    head: [["Competência", "Tipo", "Vencimento", "Valor", "Status", "Pago em"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
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
  
  const safeFileName = employer.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  doc.save(`relatorio-${safeFileName}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// SYNTHETIC REPORT - Quick totals only
export function generateSyntheticReport(data: ReportData, config: ReportConfig) {
  const doc = new jsPDF();
  
  addHeader(doc, config, "Relatório Sintético");
  
  let yPos = addSummaryCards(doc, data.summary, 50);
  
  // Quick stats
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores", 14, yPos);
  doc.setFont("helvetica", "normal");
  
  const paidPercentage = data.summary.total > 0 
    ? ((data.summary.paid / data.summary.total) * 100).toFixed(1) 
    : "0.0";
  const pendingPercentage = data.summary.total > 0 
    ? (((data.summary.pending + data.summary.overdue) / data.summary.total) * 100).toFixed(1) 
    : "0.0";
  
  const uniqueEmployers = new Set(data.contributions.map(c => c.employer_id)).size;
  
  const statsData = [
    ["Total de Contribuições", String(data.summary.count)],
    ["Empresas Envolvidas", String(uniqueEmployers)],
    ["Taxa de Recebimento", `${paidPercentage}%`],
    ["Taxa de Inadimplência", `${pendingPercentage}%`],
    ["Ticket Médio", data.summary.count > 0 ? formatCurrency(data.summary.total / data.summary.count) : "R$ 0,00"],
  ];
  
  autoTable(doc, {
    startY: yPos + 5,
    body: statsData,
    theme: "plain",
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold" },
      1: { cellWidth: 60, halign: "right" },
    },
  });
  
  addFooter(doc, config, 1, 1);
  
  doc.save(`relatorio-sintetico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ANALYTICAL REPORT - Full detailed list
export function generateAnalyticalReport(data: ReportData, config: ReportConfig) {
  const doc = new jsPDF("landscape");
  
  addHeader(doc, config, "Relatório Analítico");
  
  // Full contribution list
  const tableData = data.contributions.map((c, i) => [
    String(i + 1),
    c.employers?.name?.substring(0, 25) || "-",
    formatCNPJ(c.employers?.cnpj || ""),
    `${MONTHS[c.competence_month - 1].substring(0, 3)}/${c.competence_year}`,
    c.contribution_types?.name?.substring(0, 20) || "-",
    format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy"),
    formatCurrency(c.value),
    getStatusLabel(c.status),
    c.paid_at ? format(new Date(c.paid_at), "dd/MM/yy") : "-",
    getPaymentMethodLabel(c.payment_method),
  ]);
  
  autoTable(doc, {
    startY: 50,
    head: [["#", "Empresa", "CNPJ", "Comp.", "Tipo", "Vencimento", "Valor", "Status", "Pago em", "Forma"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 22 },
      4: { cellWidth: 35 },
      5: { cellWidth: 22 },
      6: { cellWidth: 25, halign: "right" },
      7: { cellWidth: 20, halign: "center" },
      8: { cellWidth: 22 },
      9: { cellWidth: 25 },
    },
    didDrawPage: (data) => {
      addFooter(doc, config, data.pageNumber, doc.getNumberOfPages());
    },
  });
  
  // Summary at end
  const finalY = (doc as any).lastAutoTable?.finalY || 50;
  if (finalY < 170) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${formatCurrency(data.summary.total)} | Pago: ${formatCurrency(data.summary.paid)} | Pendente: ${formatCurrency(data.summary.pending)} | Vencido: ${formatCurrency(data.summary.overdue)}`, 14, finalY + 10);
  }
  
  doc.save(`relatorio-analitico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// DEFAULTING REPORT - Only overdue and pending
export function generateDefaultingReport(data: ReportData, config: ReportConfig) {
  const doc = new jsPDF();
  
  addHeader(doc, config, "Relatório de Inadimplência");
  
  // Filter only pending and overdue
  const defaultingContributions = data.contributions.filter(
    c => c.status === 'pending' || c.status === 'overdue'
  );
  
  // Group by employer
  const byEmployer = new Map<string, {
    employer: Employer;
    contributions: Contribution[];
    total: number;
    pending: number;
    overdue: number;
  }>();
  
  defaultingContributions.forEach(c => {
    if (!c.employers) return;
    const existing = byEmployer.get(c.employer_id) || {
      employer: c.employers,
      contributions: [],
      total: 0,
      pending: 0,
      overdue: 0,
    };
    existing.contributions.push(c);
    existing.total += c.value;
    if (c.status === 'pending') existing.pending += c.value;
    if (c.status === 'overdue') existing.overdue += c.value;
    byEmployer.set(c.employer_id, existing);
  });
  
  const sortedEmployers = Array.from(byEmployer.values()).sort((a, b) => b.total - a.total);
  
  // Summary
  const totalPending = defaultingContributions.filter(c => c.status === 'pending').reduce((s, c) => s + c.value, 0);
  const totalOverdue = defaultingContributions.filter(c => c.status === 'overdue').reduce((s, c) => s + c.value, 0);
  const totalDefaulting = totalPending + totalOverdue;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total em Aberto: ${formatCurrency(totalDefaulting)}`, 14, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Pendente: ${formatCurrency(totalPending)} | Vencido: ${formatCurrency(totalOverdue)} | ${sortedEmployers.length} empresa(s) | ${defaultingContributions.length} contribuição(ões)`, 14, 59);
  
  // Table by employer
  const tableData = sortedEmployers.map(row => [
    row.employer.name.substring(0, 35),
    formatCNPJ(row.employer.cnpj),
    String(row.contributions.length),
    formatCurrency(row.pending),
    formatCurrency(row.overdue),
    formatCurrency(row.total),
  ]);
  
  autoTable(doc, {
    startY: 68,
    head: [["Empresa", "CNPJ", "Qtd", "Pendente", "Vencido", "Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [244, 63, 94], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 35 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
    foot: [["Total", "", String(defaultingContributions.length), formatCurrency(totalPending), formatCurrency(totalOverdue), formatCurrency(totalDefaulting)]],
    footStyles: { fillColor: [254, 226, 226], textColor: [0, 0, 0], fontStyle: "bold" },
  });
  
  addFooter(doc, config, 1, 1);
  
  doc.save(`relatorio-inadimplencia-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// Main export function
export function generateContributionsReport(
  type: ReportType,
  data: ReportData,
  config: ReportConfig
) {
  switch (type) {
    case 'general':
      generateGeneralReport(data, config);
      break;
    case 'by-employer':
      if (config.selectedEmployer) {
        generateByEmployerReport(data, config, config.selectedEmployer);
      } else {
        generateGeneralReport(data, config);
      }
      break;
    case 'synthetic':
      generateSyntheticReport(data, config);
      break;
    case 'analytical':
      generateAnalyticalReport(data, config);
      break;
    case 'defaulting':
      generateDefaultingReport(data, config);
      break;
    default:
      generateGeneralReport(data, config);
  }
}
