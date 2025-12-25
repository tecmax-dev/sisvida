import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialExportOptions {
  title: string;
  clinicName: string;
  period: string;
  columns: string[];
  data: (string | number)[][];
  summary?: { label: string; value: string }[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export function exportFinancialToPDF({ title, clinicName, period, columns, data, summary }: FinancialExportOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(0, 128, 128);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(clinicName, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Período: ${period}`, pageWidth / 2, 35, { align: 'center' });
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 42, { align: 'center' });

  let startY = 52;

  // Summary section if provided
  if (summary && summary.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Resumo', 14, startY);

    autoTable(doc, {
      startY: startY + 5,
      head: [['Métrica', 'Valor']],
      body: summary.map(item => [item.label, item.value]),
      theme: 'striped',
      headStyles: { fillColor: [0, 128, 128] },
      styles: { fontSize: 10 },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Main data table
  if (data.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Detalhamento', 14, startY);

    autoTable(doc, {
      startY: startY + 5,
      head: [columns],
      body: data,
      theme: 'striped',
      headStyles: { fillColor: [0, 128, 128] },
      styles: { fontSize: 9 },
      columnStyles: {
        [columns.length - 1]: { halign: 'right' },
      },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} • Eclini by Tecmax Tecnologia`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}

export function exportFinancialToExcel({ title, clinicName, period, columns, data, summary }: FinancialExportOptions) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    [title],
    ['Clínica', clinicName],
    ['Período', period],
    ['Gerado em', format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    [],
  ];

  if (summary && summary.length > 0) {
    summaryData.push(['Resumo']);
    summary.forEach(item => {
      summaryData.push([item.label, item.value]);
    });
    summaryData.push([]);
  }

  summaryData.push(['Detalhamento']);
  summaryData.push(columns);
  data.forEach(row => {
    summaryData.push(row.map(cell => String(cell)));
  });

  const sheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Relatório');

  const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

// Cash Flow specific export
export interface CashFlowData {
  date: Date;
  income: number;
  expense: number;
  pendingIncome: number;
  pendingExpense: number;
  balance: number;
  runningBalance: number;
}

export function exportCashFlow(
  clinicName: string,
  period: string,
  data: CashFlowData[],
  totals: { income: number; expense: number; pendingIncome: number; pendingExpense: number },
  format: 'pdf' | 'excel'
) {
  const columns = ['Data', 'Entradas', 'Saídas', 'A Receber', 'A Pagar', 'Saldo Dia', 'Saldo Acumulado'];
  
  const tableData = data.map(d => [
    formatDate(d.date),
    formatCurrency(d.income),
    formatCurrency(d.expense),
    formatCurrency(d.pendingIncome),
    formatCurrency(d.pendingExpense),
    formatCurrency(d.balance),
    formatCurrency(d.runningBalance),
  ]);

  const summary = [
    { label: 'Total de Entradas', value: formatCurrency(totals.income) },
    { label: 'Total de Saídas', value: formatCurrency(totals.expense) },
    { label: 'Total a Receber', value: formatCurrency(totals.pendingIncome) },
    { label: 'Total a Pagar', value: formatCurrency(totals.pendingExpense) },
    { label: 'Saldo do Período', value: formatCurrency(totals.income - totals.expense) },
  ];

  const options = {
    title: 'Fluxo de Caixa',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (format === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

// Transaction list export
export interface TransactionData {
  date: string;
  description: string;
  category: string;
  patient: string;
  paymentMethod: string;
  amount: number;
  type: 'income' | 'expense';
  status: string;
}

export function exportTransactions(
  clinicName: string,
  period: string,
  data: TransactionData[],
  totals: { income: number; expense: number },
  format: 'pdf' | 'excel'
) {
  const columns = ['Data', 'Descrição', 'Categoria', 'Paciente', 'Forma Pgto', 'Valor', 'Status'];
  
  const tableData = data.map(d => [
    d.date,
    d.description,
    d.category,
    d.patient,
    d.paymentMethod,
    `${d.type === 'expense' ? '-' : '+'} ${formatCurrency(d.amount)}`,
    d.status,
  ]);

  const summary = [
    { label: 'Total de Receitas', value: formatCurrency(totals.income) },
    { label: 'Total de Despesas', value: formatCurrency(totals.expense) },
    { label: 'Saldo', value: formatCurrency(totals.income - totals.expense) },
    { label: 'Quantidade de Transações', value: String(data.length) },
  ];

  const options = {
    title: 'Transações Financeiras',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (format === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

// Receivables export
export interface ReceivableData {
  dueDate: string;
  description: string;
  patient: string;
  status: string;
  amount: number;
}

export function exportReceivables(
  clinicName: string,
  period: string,
  data: ReceivableData[],
  totals: { total: number; overdue: number; today: number },
  format: 'pdf' | 'excel'
) {
  const columns = ['Vencimento', 'Descrição', 'Paciente', 'Status', 'Valor'];
  
  const tableData = data.map(d => [
    d.dueDate,
    d.description,
    d.patient,
    d.status,
    formatCurrency(d.amount),
  ]);

  const summary = [
    { label: 'Total a Receber', value: formatCurrency(totals.total) },
    { label: 'Atrasados', value: formatCurrency(totals.overdue) },
    { label: 'Vence Hoje', value: formatCurrency(totals.today) },
    { label: 'Quantidade', value: String(data.length) },
  ];

  const options = {
    title: 'Contas a Receber',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (format === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

// Payables export
export function exportPayables(
  clinicName: string,
  period: string,
  data: ReceivableData[],
  totals: { total: number; overdue: number; today: number },
  format: 'pdf' | 'excel'
) {
  const columns = ['Vencimento', 'Descrição', 'Fornecedor/Categoria', 'Status', 'Valor'];
  
  const tableData = data.map(d => [
    d.dueDate,
    d.description,
    d.patient,
    d.status,
    formatCurrency(d.amount),
  ]);

  const summary = [
    { label: 'Total a Pagar', value: formatCurrency(totals.total) },
    { label: 'Atrasados', value: formatCurrency(totals.overdue) },
    { label: 'Vence Hoje', value: formatCurrency(totals.today) },
    { label: 'Quantidade', value: String(data.length) },
  ];

  const options = {
    title: 'Contas a Pagar',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (format === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

// Cash registers export
export interface CashRegisterData {
  name: string;
  type: string;
  initialBalance: number;
  currentBalance: number;
  bankName?: string;
  agency?: string;
  account?: string;
}

export function exportCashRegisters(
  clinicName: string,
  data: CashRegisterData[],
  totalBalance: number,
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Nome', 'Tipo', 'Banco', 'Agência', 'Conta', 'Saldo Inicial', 'Saldo Atual'];
  
  const tableData = data.map(d => [
    d.name,
    d.type,
    d.bankName || '-',
    d.agency || '-',
    d.account || '-',
    formatCurrency(d.initialBalance),
    formatCurrency(d.currentBalance),
  ]);

  const summary = [
    { label: 'Total de Caixas/Contas', value: String(data.length) },
    { label: 'Saldo Total', value: formatCurrency(totalBalance) },
  ];

  const options = {
    title: 'Caixas e Contas Bancárias',
    clinicName,
    period: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

// Transfers export
export interface TransferData {
  date: string;
  from: string;
  to: string;
  amount: number;
  description: string;
}

export function exportTransfers(
  clinicName: string,
  period: string,
  data: TransferData[],
  totalAmount: number,
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Data', 'Origem', 'Destino', 'Valor', 'Descrição'];
  
  const tableData = data.map(d => [
    d.date,
    d.from,
    d.to,
    formatCurrency(d.amount),
    d.description || '-',
  ]);

  const summary = [
    { label: 'Total Transferido', value: formatCurrency(totalAmount) },
    { label: 'Quantidade de Transferências', value: String(data.length) },
  ];

  const options = {
    title: 'Transferências entre Caixas',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

// Commissions export
export interface CommissionData {
  professional: string;
  description: string;
  percentage: number;
  amount: number;
  status: string;
  dueDate: string;
}

export function exportCommissions(
  clinicName: string,
  period: string,
  data: CommissionData[],
  totals: { total: number; pending: number; paid: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Profissional', 'Descrição', '%', 'Valor', 'Vencimento', 'Status'];
  
  const tableData = data.map(d => [
    d.professional,
    d.description,
    `${d.percentage}%`,
    formatCurrency(d.amount),
    d.dueDate,
    d.status,
  ]);

  const summary = [
    { label: 'Total de Comissões', value: formatCurrency(totals.total) },
    { label: 'Pendentes', value: formatCurrency(totals.pending) },
    { label: 'Pagas', value: formatCurrency(totals.paid) },
  ];

  const options = {
    title: 'Comissões de Profissionais',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

// Reconciliation export
export interface ReconciliationData {
  date: string;
  description: string;
  amount: number;
  type: string;
  status: string;
}

export function exportReconciliation(
  clinicName: string,
  period: string,
  data: ReconciliationData[],
  totals: { reconciled: number; pending: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Data', 'Descrição', 'Tipo', 'Valor', 'Status'];
  
  const tableData = data.map(d => [
    d.date,
    d.description,
    d.type,
    formatCurrency(d.amount),
    d.status,
  ]);

  const summary = [
    { label: 'Transações Conciliadas', value: String(totals.reconciled) },
    { label: 'Transações Pendentes', value: String(totals.pending) },
    { label: 'Total de Transações', value: String(data.length) },
  ];

  const options = {
    title: 'Conciliação Bancária',
    clinicName,
    period,
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

// Recurring transactions export
export interface RecurringData {
  description: string;
  type: string;
  amount: number;
  frequency: string;
  nextDate: string;
  status: string;
}

export function exportRecurring(
  clinicName: string,
  data: RecurringData[],
  totals: { monthlyIncome: number; monthlyExpense: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Descrição', 'Tipo', 'Valor', 'Frequência', 'Próximo Vencimento', 'Status'];
  
  const tableData = data.map(d => [
    d.description,
    d.type,
    formatCurrency(d.amount),
    d.frequency,
    d.nextDate,
    d.status,
  ]);

  const summary = [
    { label: 'Receitas Mensais Recorrentes', value: formatCurrency(totals.monthlyIncome) },
    { label: 'Despesas Mensais Recorrentes', value: formatCurrency(totals.monthlyExpense) },
    { label: 'Saldo Mensal Recorrente', value: formatCurrency(totals.monthlyIncome - totals.monthlyExpense) },
  ];

  const options = {
    title: 'Transações Recorrentes',
    clinicName,
    period: format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
    columns,
    data: tableData,
    summary,
  };

  if (exportFormat === 'pdf') {
    exportFinancialToPDF(options);
  } else {
    exportFinancialToExcel(options);
  }
}

function formatDate(date: Date): string {
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}
