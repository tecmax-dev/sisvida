import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface StatementPdfLine {
  description: string;
  check_number?: string | null;
  supplier_name?: string | null;
  type: "income" | "expense" | string;
  amount: number;
  lineBalance: number;
  is_conciliated?: boolean | null;
}

export interface StatementPdfGroup {
  date: Date;
  transactions: StatementPdfLine[];
  totalDebit: number;
  totalCredit: number;
  endDayBalance: number;
}

export interface StatementPdfInput {
  entityName: string;
  entityCnpj?: string | null;
  logoDataUrl?: string | null;
  accountName: string;
  startDate: Date;
  endDate: Date;
  previousBalanceDate: Date;
  groups: StatementPdfGroup[];
  summary: { totalRecords: number; initialBalance: number; totalDebits: number; totalCredits: number; finalBalance: number };
  generatedAt?: Date;
}

type RGB = [number, number, number];
const BLUE: RGB = [21, 84, 180];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const BORDER: RGB = [226, 232, 240];
const RED: RGB = [200, 30, 45];
const GREEN: RGB = [5, 140, 80];
const SOFT: RGB = [241, 245, 249];
const DAYBG: RGB = [235, 241, 250];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v).replace(/\u00a0/g, " ");

/** Carrega uma imagem remota como data URL (para incorporar no PDF). */
export async function loadImageDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Gera o PDF "Movimentação e Saldo" (A4 paisagem). Apenas apresentação: os valores vêm prontos. */
export function buildStatementPdf(input: StatementPdfInput): jsPDF {
  const { summary, groups } = input;
  const gen = input.generatedAt ?? new Date();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const debitCount = groups.reduce((n, g) => n + g.transactions.filter((t) => t.type === "expense").length, 0);
  const creditCount = summary.totalRecords - debitCount;
  const period = `${format(input.startDate, "dd/MM/yyyy")} até ${format(input.endDate, "dd/MM/yyyy")}`;

  // ---------- Cabeçalho ----------
  let x = M;
  if (input.logoDataUrl) {
    try {
      const fmt = input.logoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(input.logoDataUrl, fmt, M, 8, 18, 18);
      x = M + 22;
    } catch { /* sem logo */ }
  }
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const nameLines = doc.splitTextToSize(input.entityName, 100).slice(0, 2);
  doc.text(nameLines, x, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (input.entityCnpj) doc.text(`CNPJ: ${input.entityCnpj}`, x, 13 + nameLines.length * 5);

  const tx = 150;
  doc.setDrawColor(...BORDER);
  doc.line(tx - 5, 8, tx - 5, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BLUE);
  doc.text("MOVIMENTAÇÃO E SALDO", tx, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Relatório Analítico de Movimentações Financeiras", tx, 18);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.text("Período: ", tx, 23);
  doc.setFont("helvetica", "normal");
  doc.text(period, tx + doc.getTextWidth("Período: ") + 1.5, 23);

  const bw = 62;
  const bx = W - M - bw;
  doc.setFillColor(...SOFT);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(bx, 8, bw, 18, 2, 2, "FD");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Conta / Portador", bx + 4, 13);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(input.accountName, bw - 8).slice(0, 2), bx + 4, 18);

  // ---------- Indicadores ----------
  const ky = 31;
  const kh = 17;
  const gap = 4;
  const kw = (W - 2 * M - 3 * gap) / 4;
  const kpis: { label: string; value: string; hint: string; color: RGB; bg: RGB }[] = [
    { label: "Saldo anterior", value: brl(summary.initialBalance), hint: `Em ${format(input.previousBalanceDate, "dd/MM/yyyy")}`, color: INK, bg: [248, 250, 252] },
    { label: "Total de débitos", value: brl(summary.totalDebits), hint: `${debitCount} lançamentos`, color: RED, bg: [254, 242, 242] },
    { label: "Total de créditos", value: brl(summary.totalCredits), hint: `${creditCount} lançamentos`, color: GREEN, bg: [240, 253, 244] },
    { label: "Saldo final", value: brl(summary.finalBalance), hint: `Em ${format(input.endDate, "dd/MM/yyyy")} · ${summary.totalRecords} lançamentos`, color: BLUE, bg: [239, 246, 255] },
  ];
  kpis.forEach((k, i) => {
    const kx = M + i * (kw + gap);
    doc.setFillColor(...k.bg);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(kx, ky, kw, kh, 2, 2, "FD");
    doc.setFillColor(...k.color);
    doc.rect(kx, ky + 3, 0.9, kh - 6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(k.label, kx + 5, ky + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...k.color);
    doc.text(k.value, kx + 5, ky + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(k.hint, kx + 5, ky + 15);
  });

  // ---------- Tabela ----------
  const body: any[] = [];
  groups.forEach((g) => {
    const d = format(g.date, "dd/MM/yyyy");
    const n = g.transactions.length;
    body.push([
      { content: d, colSpan: 4, styles: { fontStyle: "bold", fillColor: DAYBG, textColor: BLUE, fontSize: 8 } },
      { content: `${n} ${n === 1 ? "movimentação" : "movimentações"}`, colSpan: 4, styles: { halign: "right", fillColor: DAYBG, textColor: MUTED, fontSize: 7 } },
    ]);
    g.transactions.forEach((t) => {
      const deb = t.type === "expense";
      body.push([
        d,
        t.description || "",
        t.check_number || "-",
        t.supplier_name || "-",
        { content: deb ? brl(t.amount) : "-", styles: { textColor: deb ? RED : MUTED } },
        { content: !deb ? brl(t.amount) : "-", styles: { textColor: !deb ? GREEN : MUTED } },
        brl(t.lineBalance),
        { content: t.is_conciliated ? "Sim" : "Não", styles: { textColor: t.is_conciliated ? GREEN : MUTED } },
      ]);
    });
    const tot = { fontStyle: "bold", fillColor: SOFT, fontSize: 7.5 };
    body.push([
      { content: `Total do dia ${d}`, colSpan: 4, styles: { ...tot, textColor: INK } },
      { content: brl(g.totalDebit), styles: { ...tot, halign: "right", textColor: RED } },
      { content: brl(g.totalCredit), styles: { ...tot, halign: "right", textColor: GREEN } },
      { content: brl(g.endDayBalance), styles: { ...tot, halign: "right", textColor: INK } },
      { content: "", styles: tot },
    ]);
  });

  if (groups.length === 0) {
    body.push([{ content: "Nenhuma movimentação no período", colSpan: 8, styles: { halign: "center", textColor: MUTED } }]);
  }

  autoTable(doc, {
    startY: ky + kh + 5,
    head: [["Data", "Descrição", "Chq/Doc", "Favorecido / Origem", "Débito", "Crédito", "Saldo", "Conc."]],
    body,
    theme: "plain",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    margin: { left: M, right: M, top: 14, bottom: 14 },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 } },
    styles: { font: "helvetica", fontSize: 7.5, textColor: INK, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, overflow: "linebreak", lineColor: BORDER, lineWidth: { bottom: 0.15 } as any, valign: "middle" },
    columnStyles: {
      0: { cellWidth: 19 },
      1: { cellWidth: 66 },
      2: { cellWidth: 18 },
      3: { cellWidth: 76 },
      4: { cellWidth: 25, halign: "right", overflow: "visible" },
      5: { cellWidth: 25, halign: "right", overflow: "visible" },
      6: { cellWidth: 34, halign: "right", overflow: "visible" },
      7: { cellWidth: 14, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        if ([4, 5, 6].includes(data.column.index)) data.cell.styles.halign = "right";
        if (data.column.index === 7) data.cell.styles.halign = "center";
      }
    },
    didDrawPage: (data) => {
      // Cabeçalho reduzido nas páginas seguintes
      if (data.pageNumber > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...BLUE);
        doc.text("MOVIMENTAÇÃO E SALDO", M, 9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        doc.text(`${input.entityName} · ${input.accountName} · ${period}`, W - M, 9, { align: "right" });
      }
    },
  });

  // ---------- Resumo geral ----------
  let y = (doc as any).lastAutoTable.finalY + 6;
  const rh = 24;
  if (y + rh > H - 16) {
    doc.addPage();
    y = 16;
  }
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(M, y, W - 2 * M, rh, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...BLUE);
  doc.text("RESUMO GERAL DO PERÍODO", M + 5, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Movimentações de ${period}`, M + 5, y + 15);
  doc.text("Saldo final = Saldo inicial + Créditos − Débitos".replace("−", "-"), M + 5, y + 19.5);
  const items: { l: string; v: string; h: string; c: RGB }[] = [
    { l: "Total de registros", v: String(summary.totalRecords), h: "lançamentos", c: INK },
    { l: "Saldo inicial", v: brl(summary.initialBalance), h: `Em ${format(input.previousBalanceDate, "dd/MM/yyyy")}`, c: INK },
    { l: "Total de débitos", v: brl(summary.totalDebits), h: `${debitCount} lançamentos`, c: RED },
    { l: "Total de créditos", v: brl(summary.totalCredits), h: `${creditCount} lançamentos`, c: GREEN },
    { l: "Saldo final", v: brl(summary.finalBalance), h: `Em ${format(input.endDate, "dd/MM/yyyy")}`, c: BLUE },
  ];
  const sx = 100;
  const sw = (W - M - 4 - sx) / items.length;
  items.forEach((it, i) => {
    const ix = sx + i * sw;
    if (i > 0) { doc.setDrawColor(...BORDER); doc.line(ix - 2, y + 5, ix - 2, y + rh - 5); }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(it.l, ix + 2, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...it.c);
    doc.text(it.v, ix + 2, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(it.h, ix + 2, y + 19);
  });

  // ---------- Rodapé ----------
  const pages = doc.getNumberOfPages();
  const emitted = format(gen, "dd/MM/yyyy 'às' HH:mm");
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.line(M, H - 10, W - M, H - 10);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.text("ProSinge", M, H - 6);
    doc.setFont("helvetica", "normal");
    const left = `  — Gestão Sindical  |  ${input.entityName}${input.entityCnpj ? " - " + input.entityCnpj : ""}`;
    doc.text(left, M + doc.getTextWidth("ProSinge"), H - 6);
    doc.text(`Emitido em ${emitted}    Página ${i} de ${pages}`, W - M, H - 6, { align: "right" });
  }
  return doc;
}
