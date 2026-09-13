import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ---------------- TYPES ----------------

export interface BoletoReportRow {
  id: string;
  employerName: string;
  cnpj: string;
  competence: string;
  dueDate: string | null;
  value: number; // cents
  paidValue: number | null; // cents
  paymentDate: string | null;
  status: string;
}

export interface BoletosReportTotals {
  valorPrevisto: number;
  valorPago: number;
  valorAReceber: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  cancelledCount: number;
  pctRecebimento: number;
  pctInadimplencia: number;
}

export type BoletosColumnKey =
  | 'employerName'
  | 'cnpj'
  | 'competence'
  | 'dueDate'
  | 'value'
  | 'paidValue'
  | 'paymentDate'
  | 'status';

export interface BoletosReportOptions {
  entityName: string;
  periodLabel: string;
  filtersApplied: string[];
  rows: BoletoReportRow[];
  totals: BoletosReportTotals;
  reportType: 'summary' | 'detailed';
  visibleColumns: BoletosColumnKey[];
  sortBy: 'nome' | 'vencimento' | 'pagamento' | 'valor' | 'status';
  orientation: 'portrait' | 'landscape';
  includeTotals: boolean;
  includeChart: boolean;
}

// ---------------- HELPERS ----------------

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);

const formatDate = (date: string | null) => {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
};

const formatCNPJ = (doc: string) => {
  if (!doc) return '—';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return doc;
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
  negotiated: 'Negociado',
  awaiting_value: 'Aguardando Valor',
};

const COLUMN_DEFS: Record<BoletosColumnKey, { header: string; get: (r: BoletoReportRow) => string; align?: 'left' | 'right' | 'center' }> = {
  employerName: { header: 'Associado/Empresa', get: (r) => r.employerName || '—' },
  cnpj: { header: 'CPF/CNPJ', get: (r) => formatCNPJ(r.cnpj) },
  competence: { header: 'Competência', get: (r) => r.competence || '—' },
  dueDate: { header: 'Vencimento', get: (r) => formatDate(r.dueDate) },
  value: { header: 'Valor', get: (r) => formatCurrency(r.value), align: 'right' },
  paidValue: { header: 'Valor Pago', get: (r) => (r.paidValue != null ? formatCurrency(r.paidValue) : '—'), align: 'right' },
  paymentDate: { header: 'Data Pagamento', get: (r) => formatDate(r.paymentDate) },
  status: { header: 'Status', get: (r) => STATUS_LABEL[r.status] || r.status },
};

function sortRows(rows: BoletoReportRow[], sortBy: BoletosReportOptions['sortBy']): BoletoReportRow[] {
  const list = [...rows];
  switch (sortBy) {
    case 'nome':
      return list.sort((a, b) => a.employerName.localeCompare(b.employerName, 'pt-BR'));
    case 'vencimento':
      return list.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    case 'pagamento':
      return list.sort((a, b) => (a.paymentDate || '').localeCompare(b.paymentDate || ''));
    case 'valor':
      return list.sort((a, b) => (b.value || 0) - (a.value || 0));
    case 'status':
      return list.sort((a, b) => a.status.localeCompare(b.status, 'pt-BR'));
    default:
      return list;
  }
}

// ---------------- PDF BUILDER ----------------

export function buildBoletosReportDoc(opts: BoletosReportOptions): jsPDF {
  const doc = new jsPDF({ orientation: opts.orientation });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 32, 'F');

  try {
    doc.addImage('/apple-touch-icon-sindicato.png', 'PNG', 10, 5, 20, 20);
  } catch {
    /* logo opcional - segue sem quebrar o relatório */
  }

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Relatório de Boletos', pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(210, 210, 210);
  doc.text(opts.entityName, pageWidth / 2, 21, { align: 'center' });
  doc.text(
    `Período: ${opts.periodLabel} - Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    28,
    { align: 'center' }
  );

  let cursorY = 38;

  // Filtros aplicados
  if (opts.filtersApplied.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    const filtersText = `Filtros: ${opts.filtersApplied.join(' | ')}`;
    const wrapped = doc.splitTextToSize(filtersText, pageWidth - 28);
    doc.text(wrapped, 14, cursorY);
    cursorY += wrapped.length * 4 + 4;
  }

  // Totais / Cards
  if (opts.includeTotals) {
    const cards = [
      { label: 'Valor Previsto', value: formatCurrency(opts.totals.valorPrevisto) },
      { label: 'Valor Pago', value: formatCurrency(opts.totals.valorPago) },
      { label: 'Valor a Receber', value: formatCurrency(opts.totals.valorAReceber) },
      { label: '% Recebimento', value: `${opts.totals.pctRecebimento.toFixed(1)}%` },
    ];
    const cardWidth = (pageWidth - 28) / cards.length;
    cards.forEach((c, i) => {
      const x = 14 + cardWidth * i;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x, cursorY, cardWidth - 4, 20, 2, 2, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, x + 4, cursorY + 7);
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(c.value, x + 4, cursorY + 16);
    });
    cursorY += 26;

    const counts = [
      { label: 'Pagos', value: String(opts.totals.paidCount) },
      { label: 'Pendentes', value: String(opts.totals.pendingCount) },
      { label: 'Vencidos', value: String(opts.totals.overdueCount) },
      { label: 'Cancelados', value: String(opts.totals.cancelledCount) },
      { label: '% Inadimplência', value: `${opts.totals.pctInadimplencia.toFixed(1)}%` },
    ];
    const countWidth = (pageWidth - 28) / counts.length;
    counts.forEach((c, i) => {
      const x = 14 + countWidth * i;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, cursorY, countWidth - 4, 16, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, x + 4, cursorY + 6);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(c.value, x + 4, cursorY + 13);
    });
    cursorY += 22;
  }

  // Gráfico simples de barras
  if (opts.includeChart) {
    const chartData = [
      { label: 'Pago', value: opts.totals.paidCount, color: [16, 185, 129] },
      { label: 'Pendente', value: opts.totals.pendingCount, color: [245, 158, 11] },
      { label: 'Vencido', value: opts.totals.overdueCount, color: [225, 29, 72] },
      { label: 'Cancelado', value: opts.totals.cancelledCount, color: [100, 116, 139] },
    ];
    const maxVal = Math.max(1, ...chartData.map((c) => c.value));
    const barMaxWidth = pageWidth - 60;
    doc.setFontSize(8);
    chartData.forEach((c, i) => {
      const y = cursorY + i * 7;
      const barWidth = (c.value / maxVal) * barMaxWidth;
      doc.setTextColor(60, 60, 60);
      doc.text(c.label, 14, y + 4);
      doc.setFillColor(c.color[0], c.color[1], c.color[2]);
      doc.rect(42, y, Math.max(barWidth, 1), 5, 'F');
      doc.setTextColor(60, 60, 60);
      doc.text(String(c.value), 42 + Math.max(barWidth, 1) + 3, y + 4);
    });
    cursorY += 30;
  }

  // Tabela
  const sortedRows = sortRows(opts.rows, opts.sortBy);
  const cols = opts.visibleColumns.length > 0 ? opts.visibleColumns : (Object.keys(COLUMN_DEFS) as BoletosColumnKey[]);
  const head = [cols.map((k) => COLUMN_DEFS[k].header)];

  if (opts.reportType === 'summary') {
    // Agrupa por empresa/associado, mostrando apenas subtotal
    const grouped = new Map<string, { name: string; cnpj: string; total: number; paid: number; count: number }>();
    sortedRows.forEach((r) => {
      const key = r.employerName || '—';
      const g = grouped.get(key) || { name: r.employerName, cnpj: r.cnpj, total: 0, paid: 0, count: 0 };
      g.total += r.value || 0;
      g.paid += r.paidValue || 0;
      g.count += 1;
      grouped.set(key, g);
    });
    const body = Array.from(grouped.values()).map((g) => [
      g.name,
      formatCNPJ(g.cnpj),
      String(g.count),
      formatCurrency(g.total),
      formatCurrency(g.paid),
    ]);
    autoTable(doc, {
      startY: cursorY,
      head: [['Associado/Empresa', 'CPF/CNPJ', 'Qtd. Boletos', 'Valor Total', 'Valor Pago']],
      body,
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
  } else {
    const body = sortedRows.map((r) => cols.map((k) => COLUMN_DEFS[k].get(r)));
    autoTable(doc, {
      startY: cursorY,
      head,
      body,
      styles: { fontSize: 7.5, cellPadding: 1.4 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: cols.reduce((acc, k, i) => {
        if (COLUMN_DEFS[k].align === 'right') acc[i] = { halign: 'right' };
        return acc;
      }, {} as Record<number, any>),
      margin: { left: 14, right: 14 },
    });
  }

  // Rodapé com paginação
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} - ${opts.entityName}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  return doc;
}

export function exportBoletosReportPDF(opts: BoletosReportOptions) {
  const doc = buildBoletosReportDoc(opts);
  doc.save(`relatorio-boletos-${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
}

export function printBoletosReport(opts: BoletosReportOptions) {
  const doc = buildBoletosReportDoc(opts);
  const bloburl = doc.output('bloburl');
  window.open(bloburl as unknown as string, '_blank');
}

export function exportBoletosReportExcel(opts: BoletosReportOptions) {
  const workbook = XLSX.utils.book_new();
  const sheetData: (string | number)[][] = [
    ['Relatório de Boletos'],
    ['Entidade', opts.entityName],
    ['Período', opts.periodLabel],
    ['Emitido em', format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    ['Filtros aplicados', opts.filtersApplied.join(' | ') || 'Nenhum'],
    [],
  ];

  if (opts.includeTotals) {
    sheetData.push(['--- TOTAIS ---']);
    sheetData.push(['Valor Previsto', formatCurrency(opts.totals.valorPrevisto)]);
    sheetData.push(['Valor Pago', formatCurrency(opts.totals.valorPago)]);
    sheetData.push(['Valor a Receber', formatCurrency(opts.totals.valorAReceber)]);
    sheetData.push(['Boletos Pagos', opts.totals.paidCount]);
    sheetData.push(['Boletos Pendentes', opts.totals.pendingCount]);
    sheetData.push(['Boletos Vencidos', opts.totals.overdueCount]);
    sheetData.push(['Boletos Cancelados', opts.totals.cancelledCount]);
    sheetData.push(['% Recebimento', `${opts.totals.pctRecebimento.toFixed(1)}%`]);
    sheetData.push(['% Inadimplência', `${opts.totals.pctInadimplencia.toFixed(1)}%`]);
    sheetData.push([]);
  }

  const sortedRows = sortRows(opts.rows, opts.sortBy);
  const cols = opts.visibleColumns.length > 0 ? opts.visibleColumns : (Object.keys(COLUMN_DEFS) as BoletosColumnKey[]);

  if (opts.reportType === 'summary') {
    const grouped = new Map<string, { name: string; cnpj: string; total: number; paid: number; count: number }>();
    sortedRows.forEach((r) => {
      const key = r.employerName || '—';
      const g = grouped.get(key) || { name: r.employerName, cnpj: r.cnpj, total: 0, paid: 0, count: 0 };
      g.total += r.value || 0;
      g.paid += r.paidValue || 0;
      g.count += 1;
      grouped.set(key, g);
    });
    sheetData.push(['--- RESUMO POR ASSOCIADO/EMPRESA ---']);
    sheetData.push(['Associado/Empresa', 'CPF/CNPJ', 'Qtd. Boletos', 'Valor Total', 'Valor Pago']);
    Array.from(grouped.values()).forEach((g) => {
      sheetData.push([g.name, formatCNPJ(g.cnpj), g.count, formatCurrency(g.total), formatCurrency(g.paid)]);
    });
  } else {
    sheetData.push(['--- DETALHAMENTO ---']);
    sheetData.push(cols.map((k) => COLUMN_DEFS[k].header));
    sortedRows.forEach((r) => {
      sheetData.push(cols.map((k) => COLUMN_DEFS[k].get(r)));
    });
  }

  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Boletos');
  XLSX.writeFile(workbook, `relatorio-boletos-${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
}
