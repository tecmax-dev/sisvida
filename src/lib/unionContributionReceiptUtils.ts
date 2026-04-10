import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { numberToWords, capitalizeFirst } from './numberToWords';

export interface UnionContributionReceiptData {
  entity: {
    name: string;
    cnpj?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    email?: string | null;
    logo_url?: string | null;
  };
  employer: {
    name: string;
    cnpj: string;
    registration_number?: string | null;
  };
  contribution: {
    id: string;
    competence_month: number;
    competence_year: number;
    value: number; // in cents
    paid_value: number; // in cents
    paid_at: string;
    payment_method: string;
    contribution_type_name: string;
    notes?: string | null;
  };
  presidentSignature?: {
    signature_data?: string | null;
    president_name?: string | null;
    president_title?: string | null;
  } | null;
  receiptNumber: string;
  occurrence?: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  transferencia: 'Transferência Bancária',
  cheque: 'Cheque',
  cartao: 'Cartão',
  boleto: 'Boleto Bancário',
  outros: 'Outros',
  cash: 'Dinheiro',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  bank_transfer: 'Transferência Bancária',
};

const MONTHS = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return cnpj;
}

export function generateUnionReceiptNumber(): string {
  const now = new Date();
  const dateStr = format(now, 'yyyyMMdd');
  const randomPart = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `RCS-${dateStr}-${randomPart}`;
}

export async function generateUnionContributionReceiptPDF(data: UnionContributionReceiptData): Promise<{
  base64: string;
  fileName: string;
  blob: Blob;
}> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  const centerText = (text: string, yPos: number) => {
    doc.text(text, pageWidth / 2, yPos, { align: 'center' });
  };

  // === HEADER ===
  doc.setTextColor(0, 80, 120);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  centerText(data.entity.name, y);
  y += 7;

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  if (data.entity.cnpj) {
    centerText(`CNPJ: ${formatCNPJ(data.entity.cnpj)}`, y);
    y += 5;
  }

  const addressParts: string[] = [];
  if (data.entity.address) addressParts.push(data.entity.address);
  if (data.entity.city) addressParts.push(data.entity.city);
  if (data.entity.state) addressParts.push(data.entity.state);
  if (addressParts.length > 0) {
    centerText(addressParts.join(' - '), y);
    y += 5;
  }

  const contactParts: string[] = [];
  if (data.entity.phone) contactParts.push(`Tel: ${data.entity.phone}`);
  if (data.entity.email) contactParts.push(data.entity.email);
  if (contactParts.length > 0) {
    centerText(contactParts.join(' | '), y);
    y += 5;
  }

  // Divider
  y += 3;
  doc.setDrawColor(0, 80, 120);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // === TITLE ===
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  centerText('RECIBO DE PAGAMENTO', y);
  y += 7;
  doc.setFontSize(12);
  centerText('CONTRIBUIÇÃO SINDICAL', y);
  y += 8;

  // Receipt number and date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  centerText(`Nº ${data.receiptNumber}`, y);
  y += 5;
  const receiptDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  centerText(receiptDate, y);
  y += 12;

  // === EMPLOYER INFO ===
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEBIDO DE:', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.text(`Razão Social: ${data.employer.name}`, margin, y);
  y += 6;
  doc.text(`CNPJ: ${formatCNPJ(data.employer.cnpj)}`, margin, y);
  y += 6;
  if (data.employer.registration_number) {
    doc.text(`Nº Registro: ${data.employer.registration_number}`, margin, y);
    y += 6;
  }
  y += 5;

  // === CONTRIBUTION DETAILS ===
  doc.setFont('helvetica', 'bold');
  doc.text('REFERENTE A:', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.text(`Tipo: ${data.contribution.contribution_type_name}`, margin, y);
  y += 6;
  const competence = `${MONTHS[data.contribution.competence_month]}/${data.contribution.competence_year}`;
  doc.text(`Competência: ${competence}`, margin, y);
  y += 6;
  doc.text(`Valor Original: ${formatCurrency(data.contribution.value)}`, margin, y);
  y += 8;

  // === PAYMENT INFO ===
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR RECEBIDO:', margin, y);
  y += 8;

  doc.setFontSize(16);
  doc.setTextColor(0, 100, 50);
  doc.text(formatCurrency(data.contribution.paid_value), margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const amountInWords = capitalizeFirst(numberToWords(data.contribution.paid_value / 100));
  doc.text(`(${amountInWords})`, margin, y);
  y += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FORMA DE PAGAMENTO:', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  const methodLabel = PAYMENT_METHOD_LABELS[data.contribution.payment_method] || data.contribution.payment_method;
  doc.text(methodLabel, margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('DATA DO PAGAMENTO:', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(data.contribution.paid_at), "dd/MM/yyyy", { locale: ptBR }), margin, y);
  y += 10;

  // === OCCURRENCE / DESCRIPTION AREA ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('OCORRÊNCIA / OBSERVAÇÕES:', margin, y);
  y += 6;

  // Draw bordered area for occurrence
  const occurrenceBoxHeight = 35;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageWidth - 2 * margin, occurrenceBoxHeight);

  if (data.occurrence) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(data.occurrence, pageWidth - 2 * margin - 10);
    doc.text(lines, margin + 5, y + 6);
  } else if (data.contribution.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(data.contribution.notes, pageWidth - 2 * margin - 10);
    doc.text(lines, margin + 5, y + 6);
  }

  y += occurrenceBoxHeight + 10;

  // === DECLARATION ===
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  const declaration = `Para maior clareza, firmo o presente recibo, dando plena, total e irrevogável quitação do valor acima especificado, referente à contribuição sindical da competência ${competence}.`;
  const splitDecl = doc.splitTextToSize(declaration, pageWidth - 2 * margin);
  doc.text(splitDecl, margin, y);
  y += splitDecl.length * 5 + 20;

  // === SIGNATURES ===
  const signWidth = 70;
  const leftSignX = margin + 10;
  const rightSignX = pageWidth - margin - signWidth - 10;
  const signY = Math.min(y + 15, pageHeight - 55);

  // Left signature - President's digital signature
  if (data.presidentSignature?.signature_data) {
    try {
      const sigImg = data.presidentSignature.signature_data;
      const sigImgWidth = 50;
      const sigImgHeight = 20;
      const sigImgX = leftSignX + (signWidth - sigImgWidth) / 2;
      doc.addImage(sigImg, 'PNG', sigImgX, signY - sigImgHeight - 2, sigImgWidth, sigImgHeight);
    } catch (e) {
      console.warn('Failed to add president signature image to PDF:', e);
    }
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(leftSignX, signY, leftSignX + signWidth, signY);
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  const presName = data.presidentSignature?.president_name || data.entity.name;
  const presTitle = data.presidentSignature?.president_title || 'Presidente';
  doc.text(presName, leftSignX + signWidth / 2, signY + 5, { align: 'center' });
  doc.text(presTitle, leftSignX + signWidth / 2, signY + 10, { align: 'center' });

  // Right signature
  doc.line(rightSignX, signY, rightSignX + signWidth, signY);
  doc.text(data.employer.name.slice(0, 35), rightSignX + signWidth / 2, signY + 5, { align: 'center' });
  doc.text('Recebedor', rightSignX + signWidth / 2, signY + 10, { align: 'center' });

  // === FOOTER ===
  const footerY = pageHeight - 12;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  centerText('Documento gerado eletronicamente pelo sistema SisVida', footerY);
  centerText(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, footerY + 4);

  // Generate outputs
  const fileName = `recibo-contribuicao-${data.receiptNumber}.pdf`;
  const pdfBlob = doc.output('blob');
  const base64 = doc.output('datauristring').split(',')[1];

  return { base64, fileName, blob: pdfBlob };
}

export function printUnionContributionReceipt(data: UnionContributionReceiptData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const amountFormatted = formatCurrency(data.contribution.paid_value);
  const amountInWords = capitalizeFirst(numberToWords(data.contribution.paid_value / 100));
  const competence = `${MONTHS[data.contribution.competence_month]}/${data.contribution.competence_year}`;
  const paidDate = format(new Date(data.contribution.paid_at), "dd/MM/yyyy", { locale: ptBR });
  const methodLabel = PAYMENT_METHOD_LABELS[data.contribution.payment_method] || data.contribution.payment_method;
  const receiptDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo - ${data.receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 20px; }
    .entity-name { font-size: 20px; font-weight: bold; color: #005078; margin-bottom: 4px; }
    .entity-info { color: #666; font-size: 11px; line-height: 1.6; }
    .divider { border-top: 2px solid #005078; margin: 15px 0; }
    .title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 8px; }
    .receipt-info { text-align: center; color: #666; margin-bottom: 25px; font-size: 11px; }
    .section { margin-bottom: 18px; }
    .section-title { font-weight: bold; margin-bottom: 6px; font-size: 12px; }
    .section-content { font-size: 12px; line-height: 1.6; }
    .amount { font-size: 20px; color: #006432; font-weight: bold; }
    .amount-words { color: #666; font-style: italic; font-size: 11px; margin-top: 2px; }
    .occurrence-box { border: 1px solid #ccc; min-height: 80px; padding: 12px; margin-top: 6px; font-size: 11px; color: #333; }
    .declaration { margin-top: 25px; color: #666; font-size: 10px; text-align: justify; line-height: 1.5; }
    .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
    .signature { text-align: center; width: 40%; }
    .signature-line { border-top: 1px solid #000; margin-bottom: 5px; }
    .signature-text { font-size: 10px; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 8px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="entity-name">${data.entity.name}</div>
    <div class="entity-info">
      ${data.entity.cnpj ? `CNPJ: ${formatCNPJ(data.entity.cnpj)}<br>` : ''}
      ${[data.entity.address, data.entity.city, data.entity.state].filter(Boolean).join(' - ')}
      ${data.entity.phone ? `<br>Tel: ${data.entity.phone}` : ''}
      ${data.entity.email ? ` | ${data.entity.email}` : ''}
    </div>
  </div>

  <div class="divider"></div>

  <div class="title">RECIBO DE PAGAMENTO</div>
  <div class="subtitle">CONTRIBUIÇÃO SINDICAL</div>
  <div class="receipt-info">Nº ${data.receiptNumber}<br>${receiptDate}</div>

  <div class="section">
    <div class="section-title">RECEBIDO DE:</div>
    <div class="section-content">
      Razão Social: ${data.employer.name}<br>
      CNPJ: ${formatCNPJ(data.employer.cnpj)}
      ${data.employer.registration_number ? `<br>Nº Registro: ${data.employer.registration_number}` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">REFERENTE A:</div>
    <div class="section-content">
      Tipo: ${data.contribution.contribution_type_name}<br>
      Competência: ${competence}<br>
      Valor Original: ${formatCurrency(data.contribution.value)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">VALOR RECEBIDO:</div>
    <div class="amount">${amountFormatted}</div>
    <div class="amount-words">(${amountInWords})</div>
  </div>

  <div class="section">
    <div class="section-content">
      <strong>Forma de Pagamento:</strong> ${methodLabel}<br>
      <strong>Data do Pagamento:</strong> ${paidDate}
    </div>
  </div>

  <div class="section">
    <div class="section-title">OCORRÊNCIA / OBSERVAÇÕES:</div>
    <div class="occurrence-box">${data.occurrence || data.contribution.notes || ''}</div>
  </div>

  <div class="declaration">
    Para maior clareza, firmo o presente recibo, dando plena, total e irrevogável quitação do valor acima especificado,
    referente à contribuição sindical da competência ${competence}.
  </div>

  <div class="signatures">
    <div class="signature">
      <div class="signature-line"></div>
      <div class="signature-text">${data.entity.name}</div>
      <div class="signature-text">Assinatura e Carimbo</div>
    </div>
    <div class="signature">
      <div class="signature-line"></div>
      <div class="signature-text">${data.employer.name.slice(0, 40)}</div>
      <div class="signature-text">Recebedor</div>
    </div>
  </div>

  <div class="footer">
    Documento gerado eletronicamente pelo sistema SisVida<br>
    Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
