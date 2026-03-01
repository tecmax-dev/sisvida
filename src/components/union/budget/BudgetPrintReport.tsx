import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Download } from "lucide-react";
import { BudgetExercise, BudgetRevenue, BudgetExpense, BudgetSummary, monthNames, revenueTypeLabels, expenseTypeLabels, budgetStatusLabels } from "@/types/unionBudget";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface BudgetPrintReportProps {
  exercise: BudgetExercise;
  revenues: BudgetRevenue[];
  expenses: BudgetExpense[];
  summary: BudgetSummary;
  versionNumber?: number;
  realizedByMonth?: Record<number, { revenue: number; expense: number }>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const getMonthValue = (item: BudgetRevenue | BudgetExpense, month: number): number => {
  const key = `month_${month.toString().padStart(2, "0")}` as keyof typeof item;
  return (item[key] as number) || 0;
};

export function BudgetPrintReport({
  exercise,
  revenues,
  expenses,
  summary,
  versionNumber,
  realizedByMonth,
}: BudgetPrintReportProps) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const totalRevenue = summary.totalRevenuesBudgeted;
    const totalExpense = summary.totalExpensesBudgeted;

    const revenueRows = revenues
      .map(
        (r) =>
          `<tr><td>${r.description}</td><td>${revenueTypeLabels[r.revenue_type]}</td>${Array.from({ length: 12 }, (_, i) => `<td class="num">${formatCurrency(getMonthValue(r, i + 1))}</td>`).join("")}<td class="num bold">${formatCurrency(r.total_amount)}</td></tr>`
      )
      .join("");

    const expenseRows = expenses
      .map(
        (e) =>
          `<tr><td>${e.description}</td><td>${expenseTypeLabels[e.expense_type]}</td>${Array.from({ length: 12 }, (_, i) => `<td class="num">${formatCurrency(getMonthValue(e, i + 1))}</td>`).join("")}<td class="num bold">${formatCurrency(e.total_amount)}</td></tr>`
      )
      .join("");

    const monthHeaders = monthNames.map((m) => `<th>${m.substring(0, 3)}</th>`).join("");

    // Execution rows
    let executionRows = "";
    if (realizedByMonth) {
      executionRows = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const budRev = revenues.reduce((s, r) => s + getMonthValue(r, month), 0);
        const budExp = expenses.reduce((s, e) => s + getMonthValue(e, month), 0);
        const realRev = realizedByMonth[month]?.revenue || 0;
        const realExp = realizedByMonth[month]?.expense || 0;
        const result = realRev - realExp;
        return `<tr><td>${monthNames[i]}</td><td class="num">${formatCurrency(budRev)}</td><td class="num">${formatCurrency(realRev)}</td><td class="num">${formatCurrency(budExp)}</td><td class="num">${formatCurrency(realExp)}</td><td class="num ${result >= 0 ? "pos" : "neg"}">${formatCurrency(result)}</td></tr>`;
      }).join("");
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Relatório Orçamentário - ${exercise.name}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; color: #333; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  h2 { font-size: 13px; margin-top: 20px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  h3 { font-size: 11px; margin-top: 14px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 15px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
  .meta-item { background: #f5f5f5; padding: 8px; border-radius: 4px; }
  .meta-item .label { font-size: 9px; color: #666; text-transform: uppercase; }
  .meta-item .value { font-size: 12px; font-weight: bold; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9px; }
  th { background: #1a1a1a; color: white; padding: 5px 4px; text-align: left; font-weight: 600; }
  td { padding: 4px; border-bottom: 1px solid #ddd; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .bold { font-weight: bold; }
  .pos { color: #16a34a; }
  .neg { color: #dc2626; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
  .summary-card { border: 1px solid #ddd; padding: 10px; border-radius: 4px; text-align: center; }
  .summary-card .label { font-size: 9px; color: #666; }
  .summary-card .value { font-size: 14px; font-weight: bold; margin-top: 4px; }
  .footer { margin-top: 30px; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
  @media print { body { margin: 10px; } @page { size: landscape; margin: 10mm; } }
</style></head><body>
<div class="header">
  <div><h1>${exercise.name}</h1><p>Status: ${budgetStatusLabels[exercise.status]}${versionNumber ? ` | Versão ${versionNumber}` : ""}</p></div>
  <div style="text-align:right"><p>Período: ${format(new Date(exercise.start_date), "dd/MM/yyyy")} a ${format(new Date(exercise.end_date), "dd/MM/yyyy")}</p><p>Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p></div>
</div>

<div class="meta">
  <div class="meta-item"><div class="label">Receitas Previstas</div><div class="value pos">${formatCurrency(totalRevenue)}</div></div>
  <div class="meta-item"><div class="label">Despesas Previstas</div><div class="value neg">${formatCurrency(totalExpense)}</div></div>
  <div class="meta-item"><div class="label">Resultado Projetado</div><div class="value ${summary.projectedResult >= 0 ? "pos" : "neg"}">${formatCurrency(summary.projectedResult)}</div></div>
  <div class="meta-item"><div class="label">Margem</div><div class="value">${totalRevenue > 0 ? ((summary.projectedResult / totalRevenue) * 100).toFixed(1) : "0"}%</div></div>
</div>

<h2>Receitas Previstas</h2>
<table><thead><tr><th>Descrição</th><th>Tipo</th>${monthHeaders}<th>Total</th></tr></thead><tbody>${revenueRows}
<tr class="bold" style="background:#f0fdf4"><td colspan="2">Total Receitas</td>${Array.from({ length: 12 }, (_, i) => { const v = revenues.reduce((s, r) => s + getMonthValue(r, i + 1), 0); return `<td class="num">${formatCurrency(v)}</td>`; }).join("")}<td class="num">${formatCurrency(totalRevenue)}</td></tr>
</tbody></table>

<h2>Despesas Previstas</h2>
<table><thead><tr><th>Descrição</th><th>Tipo</th>${monthHeaders}<th>Total</th></tr></thead><tbody>${expenseRows}
<tr class="bold" style="background:#fef2f2"><td colspan="2">Total Despesas</td>${Array.from({ length: 12 }, (_, i) => { const v = expenses.reduce((s, e) => s + getMonthValue(e, i + 1), 0); return `<td class="num">${formatCurrency(v)}</td>`; }).join("")}<td class="num">${formatCurrency(totalExpense)}</td></tr>
</tbody></table>

<h2>Resultado Mensal</h2>
<table><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th><th>Resultado Acumulado</th></tr></thead><tbody>
${(() => { let acc = 0; return Array.from({ length: 12 }, (_, i) => { const r = revenues.reduce((s, rv) => s + getMonthValue(rv, i + 1), 0); const e = expenses.reduce((s, ex) => s + getMonthValue(ex, i + 1), 0); const res = r - e; acc += res; return `<tr><td>${monthNames[i]}</td><td class="num">${formatCurrency(r)}</td><td class="num">${formatCurrency(e)}</td><td class="num ${res >= 0 ? "pos" : "neg"}">${formatCurrency(res)}</td><td class="num ${acc >= 0 ? "pos" : "neg"}">${formatCurrency(acc)}</td></tr>`; }).join(""); })()}
</tbody></table>

${realizedByMonth ? `<h2>Execução Orçamentária (Previsto vs Realizado)</h2>
<table><thead><tr><th>Mês</th><th>Rec. Prevista</th><th>Rec. Realizada</th><th>Desp. Prevista</th><th>Desp. Realizada</th><th>Resultado Real</th></tr></thead><tbody>${executionRows}</tbody></table>` : ""}

<div class="footer">
  <p>Relatório gerado automaticamente pelo Sistema de Gestão Orçamentária</p>
  <p>${exercise.name} | ${format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
</div>
</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.text(exercise.name, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      `Status: ${budgetStatusLabels[exercise.status]} | Período: ${format(new Date(exercise.start_date), "dd/MM/yyyy")} - ${format(new Date(exercise.end_date), "dd/MM/yyyy")}`,
      14, 22
    );
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, pageWidth - 14, 22, { align: "right" });

    // Summary
    doc.setFontSize(10);
    doc.setTextColor(0);
    const summaryY = 30;
    const colW = (pageWidth - 28) / 4;
    [
      { label: "Receitas Previstas", value: formatCurrency(summary.totalRevenuesBudgeted) },
      { label: "Despesas Previstas", value: formatCurrency(summary.totalExpensesBudgeted) },
      { label: "Resultado Projetado", value: formatCurrency(summary.projectedResult) },
      { label: "Margem", value: `${summary.totalRevenuesBudgeted > 0 ? ((summary.projectedResult / summary.totalRevenuesBudgeted) * 100).toFixed(1) : "0"}%` },
    ].forEach((item, i) => {
      const x = 14 + i * colW;
      doc.setFillColor(245, 245, 245);
      doc.rect(x, summaryY, colW - 4, 14, "F");
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(item.label, x + 3, summaryY + 5);
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(item.value, x + 3, summaryY + 11);
    });

    // Revenue table
    let startY = summaryY + 20;
    doc.setFontSize(11);
    doc.text("Receitas Previstas", 14, startY);
    startY += 3;

    const monthShort = monthNames.map((m) => m.substring(0, 3));

    autoTable(doc, {
      startY,
      head: [["Descrição", "Tipo", ...monthShort, "Total"]],
      body: [
        ...revenues.map((r) => [
          r.description,
          revenueTypeLabels[r.revenue_type],
          ...Array.from({ length: 12 }, (_, i) => formatCurrency(getMonthValue(r, i + 1))),
          formatCurrency(r.total_amount),
        ]),
      ],
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 26, 26], fontSize: 6 },
      columnStyles: Object.fromEntries(
        Array.from({ length: 14 }, (_, i) => [i >= 2 ? i : -1, { halign: i >= 2 ? "right" : "left" }]).filter(([k]) => k !== -1)
      ),
      margin: { left: 14, right: 14 },
    });

    // Expense table
    startY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text("Despesas Previstas", 14, startY);
    startY += 3;

    autoTable(doc, {
      startY,
      head: [["Descrição", "Tipo", ...monthShort, "Total"]],
      body: [
        ...expenses.map((e) => [
          e.description,
          expenseTypeLabels[e.expense_type],
          ...Array.from({ length: 12 }, (_, i) => formatCurrency(getMonthValue(e, i + 1))),
          formatCurrency(e.total_amount),
        ]),
      ],
      styles: { fontSize: 6, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 26, 26], fontSize: 6 },
      columnStyles: Object.fromEntries(
        Array.from({ length: 14 }, (_, i) => [i >= 2 ? i : -1, { halign: i >= 2 ? "right" : "left" }]).filter(([k]) => k !== -1)
      ),
      margin: { left: 14, right: 14 },
    });

    // Execution table if available
    if (realizedByMonth) {
      startY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(11);
      doc.text("Execução Orçamentária", 14, startY);
      startY += 3;

      autoTable(doc, {
        startY,
        head: [["Mês", "Rec. Prev.", "Rec. Real.", "Desp. Prev.", "Desp. Real.", "Resultado"]],
        body: Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const budRev = revenues.reduce((s, r) => s + getMonthValue(r, month), 0);
          const budExp = expenses.reduce((s, e) => s + getMonthValue(e, month), 0);
          const realRev = realizedByMonth[month]?.revenue || 0;
          const realExp = realizedByMonth[month]?.expense || 0;
          return [monthNames[i], formatCurrency(budRev), formatCurrency(realRev), formatCurrency(budExp), formatCurrency(realExp), formatCurrency(realRev - realExp)];
        }),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [26, 26, 26], fontSize: 7 },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `${exercise.name} - Página ${i}/${pageCount} - Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 5,
        { align: "center" }
      );
    }

    doc.save(`orcamento-${exercise.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-2" />
        Imprimir
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
        <Download className="h-4 w-4 mr-2" />
        Exportar PDF
      </Button>
    </div>
  );
}
