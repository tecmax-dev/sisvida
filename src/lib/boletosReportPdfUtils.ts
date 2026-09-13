import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import type { BoletosPrintConfig, BoletosPrintColumn } from "@/components/union/reports/BoletosPrintConfigDialog";

export interface BoletoReportRow {
  id: string;
  associado: string;
  cpfCnpj: string;
  competencia: string;
  vencimento: string | null;
  valor: number;
  valorPago: number | null;
  dataPagamento: string | null;
  status: string;
  statusLabel: string;
}

export interface BoletosReportTotals {
  previsto: number;
  pago: number;
  aReceber: number;
  qtdPagos: number;
  qtdPendentes: number;
  qtdVencidos: number;
  qtdCancelados: number;
  percentualRecebimento: number;
  percentualInadimplencia: number;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return format(parseDateOnlyToLocalNoon(d.slice(0, 10)), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
};

const COLUMN_LABEL: Record<BoletosPrintColumn["key"], string> = {
  associado: "Associado / Empresa",
  cpfCnpj: "CPF / CNPJ",
  competencia: "Competência",
  vencimento: "Vencimento",
  valor: "Valor",
  valorPago: "Valor Pago",
  dataPagamento: "Data Pagamento",
  status: "Status",
};

function getCellValue(row: BoletoReportRow, key: BoletosPrintColumn["key"]): string {
  switch (key) {
    case "associado":
      return row.associado || "—";
    case "cpfCnpj":
      return row.cpfCnpj || "—";
    case "competencia":
      return row.competencia || "—";
    case "vencimento":
      return formatDate(row.vencimento);
    case "valor":
      return formatCurrency(row.valor);
    case "valorPago":
      return row.valorPago != null ? formatCurrency(row.valorPago) : "—";
    case "dataPagamento":
      return formatDate(row.dataPagamento);
    case "status":
      return row.statusLabel;
    default:
      return "—";
  }
}

export function sortBoletosRows(rows: BoletoReportRow[], ordenacao: BoletosPrintConfig["ordenacao"]): BoletoReportRow[] {
  const sorted = [...rows];
  switch (ordenacao) {
    case "nome":
      sorted.sort((a, b) => a.associado.localeCompare(b.associado));
      break;
    case "vencimento":
      sorted.sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
      break;
    case "pagamento":
      sorted.sort((a, b) => (a.dataPagamento || "").localeCompare(b.dataPagamento || ""));
      break;
    case "valor":
      sorted.sort((a, b) => b.valor - a.valor);
      break;
    case "status":
      sorted.sort((a, b) => a.status.localeCompare(b.status));
      break;
  }
  return sorted;
}

export function buildBoletosReportPdf(params: {
  rows: BoletoReportRow[];
  totals: BoletosReportTotals;
  clinicName: string;
  filtrosAplicados: string[];
  config: BoletosPrintConfig;
}) {
  const { rows, totals, clinicName, filtrosAplicados, config } = params;
  const doc = new jsPDF({ orientation: config.orientacao === "landscape" ? "landscape" : "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Relatório de Boletos", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(210, 210, 210);
  doc.text(clinicName, pageWidth / 2, 21, { align: "center" });
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    27,
    { align: "center" }
  );

  let cursorY = 40;

  if (config.incluirFiltros && filtrosAplicados.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const filtroText = `Filtros aplicados: ${filtrosAplicados.join(" • ")}`;
    const lines = doc.splitTextToSize(filtroText, pageWidth - 28);
    doc.text(lines, 14, cursorY);
    cursorY += lines.length * 4 + 4;
  }

  if (config.incluirCards) {
    const cards = [
      { label: "Valor Previsto", value: formatCurrency(totals.previsto) },
      { label: "Valor Recebido", value: formatCurrency(totals.pago) },
      { label: "Valor a Receber", value: formatCurrency(totals.aReceber) },
      { label: "% Recebimento", value: `${totals.percentualRecebimento.toFixed(1)}%` },
    ];
    const cardWidth = (pageWidth - 28) / cards.length;
    cards.forEach((c, i) => {
      const x = 14 + cardWidth * i;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x, cursorY, cardWidth - 4, 20, 2, 2, "F");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, x + 4, cursorY + 7);
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(c.value, x + 4, cursorY + 16);
    });
    cursorY += 28;

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Pagos: ${totals.qtdPagos}  •  Pendentes: ${totals.qtdPendentes}  •  Vencidos: ${totals.qtdVencidos}  •  Cancelados: ${totals.qtdCancelados}  •  Inadimplência: ${totals.percentualInadimplencia.toFixed(1)}%`,
      14,
      cursorY
    );
    cursorY += 8;
  }

  if (config.incluirGrafico) {
    const chartData = [
      { label: "Pago", value: totals.pago, color: [34, 197, 94] as [number, number, number] },
      { label: "A Receber", value: totals.aReceber, color: [234, 179, 8] as [number, number, number] },
    ];
    const maxVal = Math.max(...chartData.map((c) => c.value), 1);
    const chartWidth = pageWidth - 28;
    const barHeight = 8;
    doc.setFontSize(8);
    chartData.forEach((c, i) => {
      const y = cursorY + i * (barHeight + 6);
      const barLen = Math.max((c.value / maxVal) * (chartWidth - 60), 1);
      doc.setTextColor(60, 60, 60);
      doc.text(c.label, 14, y + barHeight - 2);
      doc.setFillColor(c.color[0], c.color[1], c.color[2]);
      doc.rect(50, y, barLen, barHeight, "F");
      doc.setTextColor(60, 60, 60);
      doc.text(formatCurrency(c.value), 50 + barLen + 3, y + barHeight - 2);
    });
    cursorY += chartData.length * (barHeight + 6) + 6;
  }

  const columns = config.tipo === "resumido"
    ? config.colunas.filter((c) => ["associado", "vencimento", "valor", "status"].includes(c))
    : config.colunas;

  const sortedRows = sortBoletosRows(rows, config.ordenacao);

  autoTable(doc, {
    startY: cursorY,
    head: [columns.map((c) => COLUMN_LABEL[c])],
    body: sortedRows.map((r) => columns.map((c) => getCellValue(r, c))),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const current = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Página ${current} de ${pageCount}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 6,
        { align: "right" }
      );
    },
  });

  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}

export function exportBoletosReportToExcel(params: {
  rows: BoletoReportRow[];
  totals: BoletosReportTotals;
  clinicName: string;
  filtrosAplicados: string[];
}) {
  const { rows, totals, clinicName, filtrosAplicados } = params;

  const headerRows: (string | number)[][] = [
    ["Relatório de Boletos"],
    [clinicName],
    [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`],
    [],
  ];

  if (filtrosAplicados.length > 0) {
    headerRows.push(["Filtros aplicados:", filtrosAplicados.join(" | ")]);
    headerRows.push([]);
  }

  headerRows.push(["Resumo"]);
  headerRows.push(["Valor Previsto", formatCurrency(totals.previsto)]);
  headerRows.push(["Valor Recebido", formatCurrency(totals.pago)]);
  headerRows.push(["Valor a Receber", formatCurrency(totals.aReceber)]);
  headerRows.push(["% Recebimento", `${totals.percentualRecebimento.toFixed(1)}%`]);
  headerRows.push(["% Inadimplência", `${totals.percentualInadimplencia.toFixed(1)}%`]);
  headerRows.push(["Qtd. Pagos", totals.qtdPagos]);
  headerRows.push(["Qtd. Pendentes", totals.qtdPendentes]);
  headerRows.push(["Qtd. Vencidos", totals.qtdVencidos]);
  headerRows.push(["Qtd. Cancelados", totals.qtdCancelados]);
  headerRows.push([]);

  const tableHead = [
    "Associado / Empresa", "CPF / CNPJ", "Competência", "Vencimento",
    "Valor", "Valor Pago", "Data Pagamento", "Status",
  ];
  const tableBody = rows.map((r) => [
    r.associado,
    r.cpfCnpj,
    r.competencia,
    formatDate(r.vencimento),
    (r.valor || 0) / 100,
    r.valorPago != null ? r.valorPago / 100 : "",
    formatDate(r.dataPagamento),
    r.statusLabel,
  ]);

  const wsData = [...headerRows, tableHead, ...tableBody];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório de Boletos");
  XLSX.writeFile(wb, `relatorio-boletos-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}
