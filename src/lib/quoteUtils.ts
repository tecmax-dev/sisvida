import jsPDF from "jspdf";
import { numberToWords, capitalizeFirst } from "./numberToWords";

export interface QuoteClinic {
  name: string;
  address?: string | null;
  phone?: string | null;
  cnpj?: string | null;
  logo_url?: string | null;
  email?: string | null;
}

export interface QuotePatient {
  name: string;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface QuoteItem {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  item_type: 'procedure' | 'product';
}

export interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  subtotal: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  total: number;
  valid_until?: string | null;
  notes?: string | null;
  created_at: string;
  items: QuoteItem[];
  clinic: QuoteClinic;
  patient: QuotePatient;
  professional?: { name: string } | null;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function calculateItemTotal(quantity: number, unitPrice: number, discount: number = 0): number {
  const subtotal = quantity * unitPrice;
  return subtotal - discount;
}

export function calculateQuoteTotals(
  items: QuoteItem[],
  discountType: 'percentage' | 'fixed',
  discountValue: number
): { subtotal: number; discount: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  
  let discount = 0;
  if (discountType === 'percentage') {
    discount = (subtotal * discountValue) / 100;
  } else {
    discount = discountValue;
  }
  
  const total = Math.max(0, subtotal - discount);
  
  return { subtotal, discount, total };
}

export function getQuoteStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    sent: 'Enviado',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    expired: 'Expirado',
    converted: 'Convertido',
  };
  return labels[status] || status;
}

export function getQuoteStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    converted: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}

export async function generateQuotePDF(data: QuoteData): Promise<{ base64: string; fileName: string; blob: Blob }> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Header com logo
  if (data.clinic.logo_url) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = data.clinic.logo_url!;
      });
      doc.addImage(img, "PNG", margin, yPos, 30, 30);
      yPos += 5;
    } catch (e) {
      console.warn("Não foi possível carregar o logo:", e);
    }
  }

  // Nome da clínica
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const clinicNameX = data.clinic.logo_url ? margin + 35 : margin;
  doc.text(data.clinic.name, clinicNameX, yPos + 5);

  // Dados da clínica
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  let infoY = yPos + 12;
  if (data.clinic.address) {
    doc.text(data.clinic.address, clinicNameX, infoY);
    infoY += 4;
  }
  if (data.clinic.phone) {
    doc.text(`Tel: ${data.clinic.phone}`, clinicNameX, infoY);
    infoY += 4;
  }
  if (data.clinic.cnpj) {
    doc.text(`CNPJ: ${data.clinic.cnpj}`, clinicNameX, infoY);
  }

  doc.setTextColor(0);
  yPos = Math.max(yPos + 35, infoY + 10);

  // Linha separadora
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Título
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ORÇAMENTO", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // Número e data
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº: ${data.quote_number}`, margin, yPos);
  doc.text(`Data: ${new Date(data.created_at).toLocaleDateString("pt-BR")}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 6;
  if (data.valid_until) {
    doc.text(`Válido até: ${new Date(data.valid_until).toLocaleDateString("pt-BR")}`, margin, yPos);
  }
  yPos += 12;

  // Dados do paciente
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${data.patient.name}`, margin, yPos);
  yPos += 5;
  if (data.patient.cpf) {
    doc.text(`CPF: ${data.patient.cpf}`, margin, yPos);
    yPos += 5;
  }
  if (data.patient.phone) {
    doc.text(`Telefone: ${data.patient.phone}`, margin, yPos);
    yPos += 5;
  }
  yPos += 8;

  // Tabela de itens
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("ITENS", margin, yPos);
  yPos += 8;

  // Cabeçalho da tabela
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 8, "F");
  doc.setFontSize(9);
  doc.text("Descrição", margin + 2, yPos);
  doc.text("Qtd", pageWidth - margin - 70, yPos, { align: "center" });
  doc.text("Valor Unit.", pageWidth - margin - 40, yPos, { align: "right" });
  doc.text("Total", pageWidth - margin - 2, yPos, { align: "right" });
  yPos += 8;

  // Itens
  doc.setFont("helvetica", "normal");
  for (const item of data.items) {
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(item.name.substring(0, 40), margin + 2, yPos);
    doc.text(String(item.quantity), pageWidth - margin - 70, yPos, { align: "center" });
    doc.text(formatCurrency(item.unit_price), pageWidth - margin - 40, yPos, { align: "right" });
    doc.text(formatCurrency(item.total), pageWidth - margin - 2, yPos, { align: "right" });
    yPos += 6;
  }

  yPos += 5;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // Totais
  const totalsX = pageWidth - margin - 60;
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", totalsX, yPos);
  doc.text(formatCurrency(data.subtotal), pageWidth - margin - 2, yPos, { align: "right" });
  yPos += 6;

  if (data.discount_value > 0) {
    const discountLabel = data.discount_type === 'percentage' 
      ? `Desconto (${data.discount_value}%):`
      : 'Desconto:';
    doc.text(discountLabel, totalsX, yPos);
    const discountAmount = data.discount_type === 'percentage'
      ? (data.subtotal * data.discount_value) / 100
      : data.discount_value;
    doc.text(`-${formatCurrency(discountAmount)}`, pageWidth - margin - 2, yPos, { align: "right" });
    yPos += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", totalsX, yPos);
  doc.text(formatCurrency(data.total), pageWidth - margin - 2, yPos, { align: "right" });
  yPos += 8;

  // Valor por extenso
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  const valorExtenso = capitalizeFirst(numberToWords(data.total));
  doc.text(`(${valorExtenso})`, margin, yPos);
  yPos += 12;

  // Observações
  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Observações:", margin, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
    doc.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4 + 10;
  }

  // Rodapé
  yPos = Math.max(yPos, 250);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100);
  doc.text("Este documento foi gerado eletronicamente pelo sistema Eclini", pageWidth / 2, yPos, { align: "center" });

  const pdfBlob = doc.output("blob");
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.readAsDataURL(pdfBlob);
  });

  const fileName = `orcamento-${data.quote_number}.pdf`;

  return { base64, fileName, blob: pdfBlob };
}

export function printQuote(data: QuoteData): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão");
  }

  const itemsRows = data.items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  const discountAmount = data.discount_type === 'percentage'
    ? (data.subtotal * data.discount_value) / 100
    : data.discount_value;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Orçamento ${data.quote_number}</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
        .logo { max-height: 60px; max-width: 120px; }
        .clinic-info { flex: 1; }
        .clinic-name { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
        .clinic-details { font-size: 11px; color: #666; }
        .title { text-align: center; font-size: 22px; font-weight: bold; margin: 20px 0; border-top: 2px solid #ddd; border-bottom: 2px solid #ddd; padding: 10px 0; }
        .quote-meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .section-title { font-weight: bold; font-size: 14px; margin: 15px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .patient-info { margin-bottom: 20px; }
        .patient-info p { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #f5f5f5; padding: 10px; text-align: left; font-size: 12px; border-bottom: 2px solid #ddd; }
        th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
        th:nth-child(3), th:nth-child(4) { text-align: right; }
        .totals { margin-top: 20px; text-align: right; }
        .totals p { margin: 4px 0; }
        .total-final { font-size: 16px; font-weight: bold; }
        .valor-extenso { font-style: italic; color: #666; margin-top: 5px; }
        .notes { margin-top: 20px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
        .notes-title { font-weight: bold; margin-bottom: 5px; }
        .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; }
        @media print {
          body { margin: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${data.clinic.logo_url ? `<img src="${data.clinic.logo_url}" class="logo" alt="Logo" />` : ''}
        <div class="clinic-info">
          <div class="clinic-name">${data.clinic.name}</div>
          <div class="clinic-details">
            ${data.clinic.address || ''}
            ${data.clinic.phone ? `<br>Tel: ${data.clinic.phone}` : ''}
            ${data.clinic.cnpj ? `<br>CNPJ: ${data.clinic.cnpj}` : ''}
          </div>
        </div>
      </div>

      <div class="title">ORÇAMENTO</div>

      <div class="quote-meta">
        <div>
          <strong>Nº:</strong> ${data.quote_number}<br>
          ${data.valid_until ? `<strong>Válido até:</strong> ${new Date(data.valid_until).toLocaleDateString('pt-BR')}` : ''}
        </div>
        <div>
          <strong>Data:</strong> ${new Date(data.created_at).toLocaleDateString('pt-BR')}
        </div>
      </div>

      <div class="section-title">CLIENTE</div>
      <div class="patient-info">
        <p><strong>Nome:</strong> ${data.patient.name}</p>
        ${data.patient.cpf ? `<p><strong>CPF:</strong> ${data.patient.cpf}</p>` : ''}
        ${data.patient.phone ? `<p><strong>Telefone:</strong> ${data.patient.phone}</p>` : ''}
      </div>

      <div class="section-title">ITENS</div>
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Qtd</th>
            <th>Valor Unit.</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="totals">
        <p>Subtotal: ${formatCurrency(data.subtotal)}</p>
        ${data.discount_value > 0 ? `
          <p>Desconto${data.discount_type === 'percentage' ? ` (${data.discount_value}%)` : ''}: -${formatCurrency(discountAmount)}</p>
        ` : ''}
        <p class="total-final">TOTAL: ${formatCurrency(data.total)}</p>
        <p class="valor-extenso">(${capitalizeFirst(numberToWords(data.total))})</p>
      </div>

      ${data.notes ? `
        <div class="notes">
          <div class="notes-title">Observações:</div>
          ${data.notes}
        </div>
      ` : ''}

      <div class="footer">
        Este documento foi gerado eletronicamente pelo sistema Eclini
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
