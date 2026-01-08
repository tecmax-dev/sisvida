import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface Contribution {
  id: string;
  value: number;
  due_date: string;
  status: string;
  competence_month: number;
  competence_year: number;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  lytex_boleto_digitable_line?: string | null;
  lytex_pix_code?: string | null;
  employers?: { 
    name: string; 
    cnpj: string;
    registration_number?: string | null;
  };
  contribution_types?: { name: string };
}

const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatCNPJ = (cnpj: string): string => {
  if (!cnpj) return "-";
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    overdue: "Vencido",
    cancelled: "Cancelado",
    processing: "Processando",
    awaiting_value: "Aguardando",
  };
  return labels[status] || status;
};

export function generateBoletosReport(contributions: Contribution[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Relatório de Boletos", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth / 2, 25, { align: "center" });
  doc.text(`${contributions.length} boleto(s) selecionado(s)`, pageWidth / 2, 31, { align: "center" });

  // Calculate total
  const total = contributions.reduce((sum, c) => sum + c.value, 0);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`Valor Total: ${formatCurrency(total)}`, 14, 45);

  // Summary table
  const tableData = contributions.map((c, i) => [
    (i + 1).toString(),
    c.employers?.registration_number || "-",
    c.employers?.name || "-",
    formatCNPJ(c.employers?.cnpj || ""),
    `${MONTHS[c.competence_month - 1]}/${c.competence_year}`,
    format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy"),
    formatCurrency(c.value),
    getStatusLabel(c.status),
  ]);

  autoTable(doc, {
    startY: 55,
    head: [["#", "Matr.", "Empresa", "CNPJ", "Competência", "Vencimento", "Valor", "Status"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 14 },
      2: { cellWidth: 50 },
      3: { cellWidth: 32 },
      4: { cellWidth: 24 },
      5: { cellWidth: 20 },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 18, halign: "center" },
    },
  });

  // Page with links and details
  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("Links para Download dos Boletos", pageWidth / 2, 13, { align: "center" });
  
  let yPos = 35;
  contributions.forEach((c, i) => {
    if (yPos > 265) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${c.employers?.name || "Empresa"}`, 14, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    yPos += 5;
    const competence = `${MONTHS[c.competence_month - 1]}/${c.competence_year}`;
    doc.text(`Competência: ${competence} | Valor: ${formatCurrency(c.value)} | Vencimento: ${format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy")}`, 14, yPos);
    
    if (c.lytex_invoice_url) {
      yPos += 5;
      doc.setTextColor(0, 0, 238);
      doc.textWithLink(c.lytex_invoice_url, 14, yPos, { url: c.lytex_invoice_url });
      doc.setTextColor(0, 0, 0);
    }
    
    if (c.lytex_boleto_digitable_line) {
      yPos += 5;
      doc.setFontSize(7);
      doc.text(`Linha Digitável: ${c.lytex_boleto_digitable_line}`, 14, yPos);
      doc.setFontSize(9);
    }
    
    yPos += 12;
  });

  // Save
  const fileName = `boletos-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
  doc.save(fileName);
}
