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

// ===== NEW EXPORT FUNCTIONS =====

// Expenses by Supplier export
export interface SupplierExpenseExportData {
  supplierName: string;
  supplierCnpj: string;
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  expenseCount: number;
}

export function exportExpensesBySupplier(
  clinicName: string,
  clinicLogo: string | null,
  period: string,
  data: SupplierExpenseExportData[],
  totals: { total: number; paid: number; pending: number; overdue: number; suppliers: number },
  exportFormat: 'pdf' | 'excel'
) {
  const columns = ['Fornecedor', 'CNPJ', 'Total', 'Pago', 'Pendente', 'Vencido', 'Qtd.'];
  
  const tableData = data.map(d => [
    d.supplierName,
    d.supplierCnpj || '-',
    formatCurrency(d.total),
    formatCurrency(d.paid),
    formatCurrency(d.pending),
    formatCurrency(d.overdue),
    String(d.expenseCount),
  ]);

  const summary = [
    { label: 'Total Gasto', value: formatCurrency(totals.total) },
    { label: 'Total Pago', value: formatCurrency(totals.paid) },
    { label: 'Total Pendente', value: formatCurrency(totals.pending) },
    { label: 'Total Vencido', value: formatCurrency(totals.overdue) },
    { label: 'Fornecedores', value: String(totals.suppliers) },
  ];

  const options = {
    title: 'Despesas por Fornecedor',
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

// Financial Report Data Types
export interface FinancialReportTransaction {
  date: string;
  description: string;
  category: string;
  supplier: string;
  patient: string;
  amount: number;
  transactionType: string;
  status: string;
}

export interface FinancialReportData {
  type: string;
  transactions: FinancialReportTransaction[];
  groupedData: any[];
  totals: {
    income: number;
    expense: number;
    balance: number;
    pending: number;
    paid: number;
  };
}

export function exportFinancialReportToPDF(
  clinicName: string,
  clinicLogo: string | null,
  period: string,
  reportTitle: string,
  data: FinancialReportData
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header with gradient effect simulation
  doc.setFillColor(30, 58, 138); // Dark blue
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Title
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(`Relatório: ${reportTitle}`, pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(clinicName, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Período: ${period}`, pageWidth / 2, 36, { align: 'center' });

  let startY = 55;

  // Summary Cards
  doc.setFontSize(10);
  doc.setTextColor(0);
  
  const cardWidth = (pageWidth - 30) / 5;
  const cardHeight = 20;
  const summaryItems = [
    { label: 'Receitas', value: formatCurrency(data.totals.income), color: [16, 185, 129] },
    { label: 'Despesas', value: formatCurrency(data.totals.expense), color: [239, 68, 68] },
    { label: 'Saldo', value: formatCurrency(data.totals.balance), color: [99, 102, 241] },
    { label: 'Pendente', value: formatCurrency(data.totals.pending), color: [245, 158, 11] },
    { label: 'Registros', value: String(data.transactions.length), color: [100, 116, 139] },
  ];

  summaryItems.forEach((item, idx) => {
    const x = 10 + (idx * (cardWidth + 2));
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(item.label, x + cardWidth / 2, startY + 7, { align: 'center' });
    doc.setFontSize(10);
    doc.text(item.value, x + cardWidth / 2, startY + 15, { align: 'center' });
  });

  startY += cardHeight + 15;

  // Grouped data table (if applicable)
  if (data.groupedData && data.groupedData.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Resumo Agrupado', 14, startY);

    autoTable(doc, {
      startY: startY + 5,
      head: [['Nome', 'Total', 'Qtd.', '% do Total']],
      body: data.groupedData.map((g: any) => {
        const totalSum = data.groupedData.reduce((sum: number, x: any) => sum + x.total, 0);
        const pct = totalSum > 0 ? ((g.total / totalSum) * 100).toFixed(1) : '0';
        return [g.name, formatCurrency(g.total), String(g.count), `${pct}%`];
      }),
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138] },
      styles: { fontSize: 9 },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Detailed transactions table
  if (data.transactions.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Detalhamento', 14, startY);

    const columns = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status'];
    const tableData = data.transactions.map(t => [
      t.date,
      t.description.substring(0, 30) + (t.description.length > 30 ? '...' : ''),
      t.category,
      t.transactionType === 'income' ? 'Receita' : 'Despesa',
      `${t.transactionType === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}`,
      t.status,
    ]);

    autoTable(doc, {
      startY: startY + 5,
      head: [columns],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138] },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { cellWidth: 50 },
        4: { halign: 'right' },
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
      `Página ${i} de ${pageCount} • Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • Eclini by Tecmax Tecnologia`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const filename = `relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}

export function exportFinancialReportToExcel(
  clinicName: string,
  period: string,
  reportTitle: string,
  data: FinancialReportData
) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet data
  const summaryData = [
    [`Relatório: ${reportTitle}`],
    ['Clínica', clinicName],
    ['Período', period],
    ['Gerado em', format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    [],
    ['Resumo'],
    ['Receitas', formatCurrency(data.totals.income)],
    ['Despesas', formatCurrency(data.totals.expense)],
    ['Saldo', formatCurrency(data.totals.balance)],
    ['Pendente', formatCurrency(data.totals.pending)],
    ['Registros', String(data.transactions.length)],
    [],
  ];

  // Add grouped data if available
  if (data.groupedData && data.groupedData.length > 0) {
    summaryData.push(['Resumo Agrupado']);
    summaryData.push(['Nome', 'Total', 'Quantidade']);
    data.groupedData.forEach((g: any) => {
      summaryData.push([g.name, formatCurrency(g.total), String(g.count)]);
    });
    summaryData.push([]);
  }

  // Add transactions
  summaryData.push(['Detalhamento']);
  summaryData.push(['Data', 'Descrição', 'Categoria', 'Fornecedor', 'Tipo', 'Valor', 'Status']);
  data.transactions.forEach(t => {
    summaryData.push([
      t.date,
      t.description,
      t.category,
      t.supplier,
      t.transactionType === 'income' ? 'Receita' : 'Despesa',
      formatCurrency(t.amount),
      t.status,
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Relatório');

  const filename = `relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
