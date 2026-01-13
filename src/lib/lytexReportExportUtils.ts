import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ==================== TYPES ====================

export interface LytexReportExportOptions {
  title: string;
  clinicName: string;
  period: string;
  columns: string[];
  data: (string | number)[][];
  summary?: { label: string; value: string; color?: string }[];
  groupedData?: { group: string; rows: (string | number)[][]; subtotal?: string }[];
}

export interface ReceivedPayment {
  id: string;
  employerName: string;
  employerCnpj: string;
  paidAt: string;
  paidValue: number;
  paymentMethod: string;
  invoiceId: string;
  competence: string;
  contributionType: string;
  feeAmount?: number;
  netValue?: number;
}

export interface PendingContribution {
  id: string;
  employerName: string;
  employerCnpj: string;
  originalValue: number;
  updatedValue: number;
  dueDate: string;
  daysOverdue: number;
  status: string;
  competence: string;
  contributionType: string;
}

export interface EmployerPendingSummary {
  employerId: string;
  employerName: string;
  employerCnpj: string;
  totalOpen: number;
  pendingCount: number;
  oldestDueDate: string;
  maxDaysOverdue: number;
}

export interface PeriodSummary {
  period: string;
  totalBilled: number;
  totalReceived: number;
  totalOpen: number;
  receivedCount: number;
  pendingCount: number;
}

export interface InterestCalculation {
  id: string;
  employerName: string;
  employerCnpj: string;
  originalValue: number;
  interestRate: number;
  interestAmount: number;
  fineAmount: number;
  updatedValue: number;
  daysOverdue: number;
  dueDate: string;
  competence: string;
}

export interface ContributionReport {
  id: string;
  employerName: string;
  employerCnpj: string;
  contributionType: string;
  value: number;
  competence: string;
  dueDate: string;
  status: string;
  paidAt?: string;
}

export interface UnbilledEmployer {
  employerId: string;
  employerName: string;
  employerCnpj: string;
  lastBillingDate: string | null;
  daysSinceLastBilling: number | null;
}

export interface PaymentRanking {
  employerId: string;
  employerName: string;
  employerCnpj: string;
  totalPaid: number;
  paymentCount: number;
  avgPaymentDays: number;
}

export interface CollectionRecord {
  id: string;
  employerName: string;
  employerCnpj: string;
  issueDate: string;
  status: string;
  channel: string;
  amount: number;
  competence: string;
}

export interface FinancialHistory {
  id: string;
  date: string;
  type: 'billing' | 'payment' | 'adjustment' | 'collection';
  description: string;
  amount: number;
  balance: number;
}

export interface NominalListEntry {
  employerId: string;
  employerName: string;
  employerCnpj: string;
  billedValue: number;
  receivedValue: number;
  pendingValue: number;
  status: 'compliant' | 'partial' | 'defaulter';
}

// ==================== HELPERS ====================

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const formatCurrencyValue = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (date: string | Date) => {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
};

const formatCNPJ = (cnpj: string) => {
  if (!cnpj) return "—";
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return cnpj;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

// ==================== BASE EXPORT FUNCTIONS ====================

export function exportLytexReportToPDF({ title, clinicName, period, columns, data, summary, groupedData }: LytexReportExportOptions) {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header gradient simulation
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setTextColor(200, 200, 200);
  doc.text(clinicName, pageWidth / 2, 26, { align: 'center' });
  doc.text(`Período: ${period} • Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 33, { align: 'center' });

  let startY = 50;

  // Summary cards
  if (summary && summary.length > 0) {
    const cardWidth = (pageWidth - 40) / Math.min(summary.length, 4);
    summary.slice(0, 4).forEach((item, index) => {
      const x = 14 + (cardWidth * index);
      
      // Card background
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(x, startY, cardWidth - 6, 24, 3, 3, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(item.label, x + 5, startY + 8);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(item.value, x + 5, startY + 19);
    });
    startY += 34;
  }

  // Grouped data
  if (groupedData && groupedData.length > 0) {
    groupedData.forEach((group) => {
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(group.group, 14, startY);
      
      autoTable(doc, {
        startY: startY + 3,
        head: [columns],
        body: group.rows,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      
      if (group.subtotal) {
        startY = (doc as any).lastAutoTable.finalY + 3;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Subtotal: ${group.subtotal}`, pageWidth - 20, startY, { align: 'right' });
        startY += 10;
      } else {
        startY = (doc as any).lastAutoTable.finalY + 8;
      }
    });
  }

  // Main data table
  if (data.length > 0) {
    autoTable(doc, {
      startY: startY,
      head: [columns],
      body: data,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], fontSize: 8 }, // emerald-500
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        [columns.length - 1]: { halign: 'right' },
      },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} • Eclini by Tecmax Tecnologia`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}

export function exportLytexReportToExcel({ title, clinicName, period, columns, data, summary, groupedData }: LytexReportExportOptions) {
  const workbook = XLSX.utils.book_new();

  const worksheetData: (string | number)[][] = [
    [title],
    ['Entidade', clinicName],
    ['Período', period],
    ['Gerado em', format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    [],
  ];

  if (summary && summary.length > 0) {
    worksheetData.push(['=== RESUMO ===']);
    summary.forEach(item => {
      worksheetData.push([item.label, item.value]);
    });
    worksheetData.push([]);
  }

  if (groupedData && groupedData.length > 0) {
    groupedData.forEach(group => {
      worksheetData.push([`=== ${group.group} ===`]);
      worksheetData.push(columns);
      group.rows.forEach(row => worksheetData.push(row));
      if (group.subtotal) {
        worksheetData.push(['Subtotal', '', '', '', '', group.subtotal]);
      }
      worksheetData.push([]);
    });
  }

  if (data.length > 0) {
    worksheetData.push(['=== DETALHAMENTO ===']);
    worksheetData.push(columns);
    data.forEach(row => worksheetData.push(row));
  }

  const sheet = XLSX.utils.aoa_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Relatório');

  const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

// ==================== SPECIFIC REPORT EXPORTS ====================

// 1. Relatório de Recebimentos
export function exportReceivedPayments(
  clinicName: string,
  period: string,
  data: ReceivedPayment[],
  totals: { total: number; fees: number; net: number; count: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Data Pgto', 'Competência', 'Tipo', 'Forma Pgto', 'Valor', 'Taxa', 'Líquido'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    formatDate(d.paidAt),
    d.competence,
    d.contributionType,
    d.paymentMethod || 'Boleto',
    formatCurrency(d.paidValue),
    formatCurrency(d.feeAmount || 0),
    formatCurrency(d.netValue || d.paidValue),
  ]);

  const summary = [
    { label: 'Total Recebido', value: formatCurrency(totals.total) },
    { label: 'Total Taxas', value: formatCurrency(totals.fees) },
    { label: 'Total Líquido', value: formatCurrency(totals.net) },
    { label: 'Qtd. Pagamentos', value: String(totals.count) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Relatório de Recebimentos',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 2. Relatório de Pendências
export function exportPendingContributions(
  clinicName: string,
  period: string,
  data: PendingContribution[],
  totals: { totalOriginal: number; totalUpdated: number; count: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Competência', 'Vencimento', 'Valor Original', 'Valor Atualizado', 'Dias Atraso', 'Status'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    d.competence,
    formatDate(d.dueDate),
    formatCurrency(d.originalValue),
    formatCurrency(d.updatedValue),
    d.daysOverdue > 0 ? String(d.daysOverdue) : '—',
    d.status === 'overdue' ? 'Vencido' : 'Pendente',
  ]);

  const summary = [
    { label: 'Valor Original', value: formatCurrency(totals.totalOriginal) },
    { label: 'Valor Atualizado', value: formatCurrency(totals.totalUpdated) },
    { label: 'Qtd. Títulos', value: String(totals.count) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Relatório de Pendências',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 3. Relatório de Pendências por Empresa
export function exportPendingByEmployer(
  clinicName: string,
  period: string,
  data: EmployerPendingSummary[],
  totals: { totalOpen: number; employerCount: number; titleCount: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Total em Aberto', 'Qtd. Títulos', 'Vencimento Mais Antigo', 'Maior Atraso'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    formatCurrency(d.totalOpen),
    String(d.pendingCount),
    formatDate(d.oldestDueDate),
    d.maxDaysOverdue > 0 ? `${d.maxDaysOverdue} dias` : '—',
  ]);

  const summary = [
    { label: 'Total em Aberto', value: formatCurrency(totals.totalOpen) },
    { label: 'Empresas Devedoras', value: String(totals.employerCount) },
    { label: 'Títulos Pendentes', value: String(totals.titleCount) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Pendências por Empresa',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 4. Relatório Agrupado por Período
export function exportPeriodSummary(
  clinicName: string,
  period: string,
  data: PeriodSummary[],
  totals: { billed: number; received: number; open: number },
  grouping: 'daily' | 'monthly' | 'yearly',
  exportFormat: 'pdf' | 'excel'
) {
  const groupLabel = grouping === 'daily' ? 'Dia' : grouping === 'monthly' ? 'Mês' : 'Ano';
  const columns = [groupLabel, 'Total Faturado', 'Total Recebido', 'Total em Aberto', 'Recebidos', 'Pendentes'];
  
  const tableData = data.map(d => [
    d.period,
    formatCurrency(d.totalBilled),
    formatCurrency(d.totalReceived),
    formatCurrency(d.totalOpen),
    String(d.receivedCount),
    String(d.pendingCount),
  ]);

  const summary = [
    { label: 'Total Faturado', value: formatCurrency(totals.billed) },
    { label: 'Total Recebido', value: formatCurrency(totals.received) },
    { label: 'Total em Aberto', value: formatCurrency(totals.open) },
    { label: '% Recebimento', value: totals.billed > 0 ? `${((totals.received / totals.billed) * 100).toFixed(1)}%` : '0%' },
  ];

  const options: LytexReportExportOptions = {
    title: `Relatório por Período (${groupLabel})`,
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 5. Relatório de Cálculo de Juros e Multa
export function exportInterestCalculations(
  clinicName: string,
  period: string,
  data: InterestCalculation[],
  totals: { originalTotal: number; interestTotal: number; fineTotal: number; updatedTotal: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Competência', 'Vencimento', 'Valor Original', '% Juros', 'Juros', 'Multa', 'Valor Atualizado'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    d.competence,
    formatDate(d.dueDate),
    formatCurrency(d.originalValue),
    `${d.interestRate.toFixed(2)}%`,
    formatCurrency(d.interestAmount),
    formatCurrency(d.fineAmount),
    formatCurrency(d.updatedValue),
  ]);

  const summary = [
    { label: 'Valor Original', value: formatCurrency(totals.originalTotal) },
    { label: 'Total Juros', value: formatCurrency(totals.interestTotal) },
    { label: 'Total Multas', value: formatCurrency(totals.fineTotal) },
    { label: 'Valor Atualizado', value: formatCurrency(totals.updatedTotal) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Cálculo de Juros e Multa',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 6. Relatório de Contribuições
export function exportContributionsReport(
  clinicName: string,
  period: string,
  data: ContributionReport[],
  totals: { total: number; paid: number; pending: number; overdue: number; count: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Tipo', 'Competência', 'Vencimento', 'Valor', 'Status', 'Data Pgto'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    d.contributionType,
    d.competence,
    formatDate(d.dueDate),
    formatCurrency(d.value),
    d.status === 'paid' ? 'Pago' : d.status === 'overdue' ? 'Vencido' : 'Pendente',
    d.paidAt ? formatDate(d.paidAt) : '—',
  ]);

  const summary = [
    { label: 'Total', value: formatCurrency(totals.total) },
    { label: 'Pagos', value: formatCurrency(totals.paid) },
    { label: 'Pendentes', value: formatCurrency(totals.pending) },
    { label: 'Vencidos', value: formatCurrency(totals.overdue) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Relatório de Contribuições',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 7. Empresas Não Faturadas
export function exportUnbilledEmployers(
  clinicName: string,
  period: string,
  data: UnbilledEmployer[],
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Último Faturamento', 'Dias sem Faturamento'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    d.lastBillingDate ? formatDate(d.lastBillingDate) : 'Nunca',
    d.daysSinceLastBilling !== null ? String(d.daysSinceLastBilling) : '—',
  ]);

  const summary = [
    { label: 'Empresas sem Faturamento', value: String(data.length) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Empresas Não Faturadas',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 8. Ranking de Pagamentos
export function exportPaymentRanking(
  clinicName: string,
  period: string,
  data: PaymentRanking[],
  totals: { totalPaid: number; employerCount: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Posição', 'Empresa', 'CNPJ', 'Total Pago', 'Qtd. Pagamentos', 'Média Dias'];
  
  const tableData = data.map((d, index) => [
    String(index + 1),
    d.employerName,
    formatCNPJ(d.employerCnpj),
    formatCurrency(d.totalPaid),
    String(d.paymentCount),
    d.avgPaymentDays > 0 ? `${d.avgPaymentDays.toFixed(0)} dias` : '—',
  ]);

  const summary = [
    { label: 'Total Pago', value: formatCurrency(totals.totalPaid) },
    { label: 'Empresas Pagantes', value: String(totals.employerCount) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Ranking de Pagamentos',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 9. Relatório de Cobranças (placeholder - needs collection logs table)
export function exportCollections(
  clinicName: string,
  period: string,
  data: CollectionRecord[],
  totals: { total: number; sent: number; pending: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Data Emissão', 'Competência', 'Valor', 'Status', 'Canal'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    formatDate(d.issueDate),
    d.competence,
    formatCurrency(d.amount),
    d.status,
    d.channel,
  ]);

  const summary = [
    { label: 'Total Cobrado', value: formatCurrency(totals.total) },
    { label: 'Enviadas', value: String(totals.sent) },
    { label: 'Pendentes', value: String(totals.pending) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Relatório de Cobranças',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 10. Carta de Cobrança
export function generateCollectionLetter(
  clinicName: string,
  clinicAddress: string,
  employer: { name: string; cnpj: string; address?: string },
  debts: { competence: string; value: number; dueDate: string }[],
  totalDebt: number
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  
  // Header
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(clinicName, pageWidth / 2, 25, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (clinicAddress) {
    doc.text(clinicAddress, pageWidth / 2, 32, { align: 'center' });
  }
  
  // Date and location
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Local, ${today}`, pageWidth - 20, 50, { align: 'right' });
  
  // Recipient
  doc.setFontSize(11);
  doc.text('À', 20, 70);
  doc.setFont(undefined as any, 'bold');
  doc.text(employer.name, 20, 77);
  doc.setFont(undefined as any, 'normal');
  doc.text(`CNPJ: ${formatCNPJ(employer.cnpj)}`, 20, 84);
  if (employer.address) {
    doc.text(employer.address, 20, 91);
  }
  
  // Subject
  doc.setFont(undefined as any, 'bold');
  doc.text('Ref.: COBRANÇA DE DÉBITOS SINDICAIS', 20, 110);
  doc.setFont(undefined as any, 'normal');
  
  // Body
  const bodyText = `Prezados Senhores,

Através da presente, vimos notificá-los sobre a existência de débitos pendentes junto a esta entidade sindical, conforme detalhamento abaixo:`;
  
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(bodyText, pageWidth - 40);
  doc.text(lines, 20, 125);
  
  // Debt table
  autoTable(doc, {
    startY: 155,
    head: [['Competência', 'Vencimento', 'Valor']],
    body: debts.map(d => [
      d.competence,
      formatDate(d.dueDate),
      formatCurrency(d.value),
    ]),
    foot: [['', 'TOTAL', formatCurrency(totalDebt)]],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
    margin: { left: 20, right: 20 },
  });
  
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  const closingText = `Solicitamos a regularização dos débitos acima no prazo de 10 (dez) dias corridos a contar do recebimento desta notificação, sob pena de adoção das medidas judiciais cabíveis.

Para pagamento ou esclarecimentos, favor entrar em contato conosco.

Atenciosamente,`;
  
  const closingLines = doc.splitTextToSize(closingText, pageWidth - 40);
  doc.text(closingLines, 20, finalY);
  
  doc.text('_______________________________', pageWidth / 2, finalY + 50, { align: 'center' });
  doc.text(clinicName, pageWidth / 2, finalY + 57, { align: 'center' });
  
  const filename = `carta-cobranca-${employer.cnpj.replace(/\D/g, '')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}

// 11. Histórico Financeiro por Empresa
export function exportFinancialHistoryByEmployer(
  clinicName: string,
  employer: { name: string; cnpj: string },
  data: FinancialHistory[],
  period: string,
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Data', 'Tipo', 'Descrição', 'Valor', 'Saldo'];
  
  const typeLabels: Record<string, string> = {
    billing: 'Faturamento',
    payment: 'Pagamento',
    adjustment: 'Ajuste',
    collection: 'Cobrança',
  };
  
  const tableData = data.map(d => [
    formatDate(d.date),
    typeLabels[d.type] || d.type,
    d.description,
    formatCurrency(d.amount),
    formatCurrency(d.balance),
  ]);

  const options: LytexReportExportOptions = {
    title: `Histórico Financeiro - ${employer.name}`,
    clinicName,
    period,
    columns,
    data: tableData,
    summary: [
      { label: 'Empresa', value: employer.name },
      { label: 'CNPJ', value: formatCNPJ(employer.cnpj) },
      { label: 'Total Registros', value: String(data.length) },
    ],
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 12. Lista Nominal (Fechamento)
export function exportNominalList(
  clinicName: string,
  period: string,
  data: NominalListEntry[],
  totals: { billed: number; received: number; pending: number; compliantCount: number; defaulterCount: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Faturado', 'Recebido', 'Pendente', 'Situação'];
  
  const statusLabels: Record<string, string> = {
    compliant: 'Adimplente',
    partial: 'Parcial',
    defaulter: 'Inadimplente',
  };
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    formatCurrency(d.billedValue),
    formatCurrency(d.receivedValue),
    formatCurrency(d.pendingValue),
    statusLabels[d.status] || d.status,
  ]);

  const summary = [
    { label: 'Total Faturado', value: formatCurrency(totals.billed) },
    { label: 'Total Recebido', value: formatCurrency(totals.received) },
    { label: 'Total Pendente', value: formatCurrency(totals.pending) },
    { label: 'Adimplentes', value: String(totals.compliantCount) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Lista Nominal - Fechamento',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 13. Relatório de Adimplentes
export function exportCompliantEmployers(
  clinicName: string,
  period: string,
  data: { employerName: string; employerCnpj: string; lastPayment: string; totalPaid: number }[],
  totals: { count: number; totalPaid: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Último Pagamento', 'Total Pago'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    formatDate(d.lastPayment),
    formatCurrency(d.totalPaid),
  ]);

  const summary = [
    { label: 'Empresas Adimplentes', value: String(totals.count) },
    { label: 'Total Arrecadado', value: formatCurrency(totals.totalPaid) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Relatório de Adimplentes',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}

// 14. Relatório de Inadimplentes
export function exportDefaulterEmployers(
  clinicName: string,
  period: string,
  data: { employerName: string; employerCnpj: string; totalOpen: number; maxDaysOverdue: number; oldestDebt: string }[],
  totals: { count: number; totalOpen: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Empresa', 'CNPJ', 'Total em Aberto', 'Maior Atraso', 'Débito Mais Antigo'];
  
  const tableData = data.map(d => [
    d.employerName,
    formatCNPJ(d.employerCnpj),
    formatCurrency(d.totalOpen),
    `${d.maxDaysOverdue} dias`,
    formatDate(d.oldestDebt),
  ]);

  const summary = [
    { label: 'Empresas Inadimplentes', value: String(totals.count) },
    { label: 'Total em Aberto', value: formatCurrency(totals.totalOpen) },
  ];

  const options: LytexReportExportOptions = {
    title: 'Relatório de Inadimplentes',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportLytexReportToPDF(options);
  } else {
    exportLytexReportToExcel(options);
  }
}
