import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { numberToWords, capitalizeFirst } from './numberToWords';

export interface PaymentReceiptData {
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
    cnpj?: string | null;
    logo_url?: string | null;
  };
  patient?: {
    name: string;
    cpf?: string | null;
  };
  transaction: {
    id: string;
    description: string;
    amount: number;
    payment_method?: string | null;
    paid_date?: string | null;
    procedure_name?: string | null;
    professional_name?: string | null;
  };
  receiptNumber: string;
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  pix: 'PIX',
  bank_transfer: 'Transferência Bancária',
  check: 'Cheque',
  insurance: 'Convênio',
};

export function formatReceiptNumber(clinicId: string): string {
  const now = new Date();
  const dateStr = format(now, 'yyyyMMdd');
  const randomPart = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `REC-${dateStr}-${randomPart}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export async function generatePaymentReceiptPDF(data: PaymentReceiptData): Promise<{
  base64: string;
  fileName: string;
  blob: Blob;
}> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Helper function to add centered text
  const centerText = (text: string, yPos: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    doc.text(text, pageWidth / 2, yPos, { align: 'center' });
  };

  // Header with clinic info
  doc.setTextColor(0, 100, 100);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  centerText(data.clinic.name, y);
  y += 8;

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (data.clinic.address) {
    centerText(data.clinic.address, y);
    y += 5;
  }
  
  const contactParts: string[] = [];
  if (data.clinic.phone) contactParts.push(`Tel: ${data.clinic.phone}`);
  if (data.clinic.cnpj) contactParts.push(`CNPJ: ${data.clinic.cnpj}`);
  
  if (contactParts.length > 0) {
    centerText(contactParts.join(' | '), y);
    y += 5;
  }

  // Divider line
  y += 5;
  doc.setDrawColor(0, 100, 100);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  centerText('RECIBO DE PAGAMENTO', y);
  y += 10;

  // Receipt number and date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  centerText(`Nº ${data.receiptNumber}`, y);
  y += 6;
  
  const receiptDate = data.transaction.paid_date 
    ? format(new Date(data.transaction.paid_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  centerText(receiptDate, y);
  y += 15;

  // Receipt body
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  
  const amount = Number(data.transaction.amount);
  const amountFormatted = formatCurrency(amount);
  const amountInWords = capitalizeFirst(numberToWords(amount));
  
  // Recipient info
  if (data.patient) {
    doc.setFont('helvetica', 'bold');
    doc.text('RECEBI DE:', margin, y);
    y += 7;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${data.patient.name}`, margin, y);
    y += 6;
    
    if (data.patient.cpf) {
      doc.text(`CPF: ${data.patient.cpf}`, margin, y);
      y += 6;
    }
    y += 5;
  }

  // Amount section
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR:', margin, y);
  y += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(0, 100, 100);
  doc.text(amountFormatted, margin, y);
  y += 7;
  
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text(`(${amountInWords})`, margin, y);
  y += 12;

  // Description
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('REFERENTE A:', margin, y);
  y += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.text(data.transaction.description, margin, y);
  y += 6;
  
  if (data.transaction.procedure_name) {
    doc.text(`Procedimento: ${data.transaction.procedure_name}`, margin, y);
    y += 6;
  }
  
  if (data.transaction.professional_name) {
    doc.text(`Profissional: ${data.transaction.professional_name}`, margin, y);
    y += 6;
  }
  y += 5;

  // Payment method
  if (data.transaction.payment_method) {
    doc.setFont('helvetica', 'bold');
    doc.text('FORMA DE PAGAMENTO:', margin, y);
    y += 7;
    
    doc.setFont('helvetica', 'normal');
    const methodLabel = paymentMethodLabels[data.transaction.payment_method] || data.transaction.payment_method;
    doc.text(methodLabel, margin, y);
    y += 15;
  }

  // Declaration text
  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const declarationText = data.patient
    ? `Para maior clareza, firmo o presente recibo, dando plena, rotal e irrevogável quitação do valor acima especificado.`
    : `Para maior clareza, firmo o presente recibo.`;
  
  const splitDeclaration = doc.splitTextToSize(declarationText, pageWidth - (2 * margin));
  doc.text(splitDeclaration, margin, y);
  y += splitDeclaration.length * 6 + 20;

  // Signature area
  const signatureY = y + 15;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  const signatureWidth = 80;
  const signatureX = (pageWidth - signatureWidth) / 2;
  doc.line(signatureX, signatureY, signatureX + signatureWidth, signatureY);
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  centerText(data.clinic.name, signatureY + 6);
  centerText('Assinatura e Carimbo', signatureY + 12);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  centerText('Documento gerado eletronicamente pelo sistema Eclini', footerY);
  centerText(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, footerY + 5);

  // Generate outputs
  const fileName = `recibo-${data.receiptNumber}.pdf`;
  const pdfBlob = doc.output('blob');
  const base64 = doc.output('datauristring').split(',')[1];

  return {
    base64,
    fileName,
    blob: pdfBlob,
  };
}

export function printReceipt(data: PaymentReceiptData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const amount = Number(data.transaction.amount);
  const amountFormatted = formatCurrency(amount);
  const amountInWords = capitalizeFirst(numberToWords(amount));
  const receiptDate = data.transaction.paid_date 
    ? format(new Date(data.transaction.paid_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const paymentMethod = data.transaction.payment_method 
    ? paymentMethodLabels[data.transaction.payment_method] || data.transaction.payment_method
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Recibo de Pagamento - ${data.receiptNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif; 
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header { text-align: center; margin-bottom: 30px; }
        .clinic-name { 
          font-size: 24px; 
          font-weight: bold; 
          color: #006666;
          margin-bottom: 8px;
        }
        .clinic-info { color: #666; font-size: 12px; }
        .divider { 
          border-top: 2px solid #006666; 
          margin: 20px 0;
        }
        .title { 
          text-align: center; 
          font-size: 18px; 
          font-weight: bold;
          margin-bottom: 10px;
        }
        .receipt-info { 
          text-align: center; 
          color: #666; 
          margin-bottom: 30px;
        }
        .section { margin-bottom: 20px; }
        .section-title { 
          font-weight: bold; 
          margin-bottom: 8px;
        }
        .amount { 
          font-size: 18px; 
          color: #006666; 
          font-weight: bold;
        }
        .amount-words { 
          color: #666; 
          font-style: italic;
          margin-top: 4px;
        }
        .declaration {
          margin-top: 30px;
          color: #666;
          font-size: 12px;
          text-align: justify;
        }
        .signature {
          margin-top: 60px;
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #000;
          width: 250px;
          margin: 0 auto 10px;
        }
        .signature-text { font-size: 12px; }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #999;
          font-size: 10px;
        }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="clinic-name">${data.clinic.name}</div>
        ${data.clinic.address ? `<div class="clinic-info">${data.clinic.address}</div>` : ''}
        <div class="clinic-info">
          ${[data.clinic.phone ? `Tel: ${data.clinic.phone}` : '', data.clinic.cnpj ? `CNPJ: ${data.clinic.cnpj}` : ''].filter(Boolean).join(' | ')}
        </div>
      </div>
      
      <div class="divider"></div>
      
      <div class="title">RECIBO DE PAGAMENTO</div>
      <div class="receipt-info">
        Nº ${data.receiptNumber}<br>
        ${receiptDate}
      </div>
      
      ${data.patient ? `
        <div class="section">
          <div class="section-title">RECEBI DE:</div>
          <div>Nome: ${data.patient.name}</div>
          ${data.patient.cpf ? `<div>CPF: ${data.patient.cpf}</div>` : ''}
        </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">VALOR:</div>
        <div class="amount">${amountFormatted}</div>
        <div class="amount-words">(${amountInWords})</div>
      </div>
      
      <div class="section">
        <div class="section-title">REFERENTE A:</div>
        <div>${data.transaction.description}</div>
        ${data.transaction.procedure_name ? `<div>Procedimento: ${data.transaction.procedure_name}</div>` : ''}
        ${data.transaction.professional_name ? `<div>Profissional: ${data.transaction.professional_name}</div>` : ''}
      </div>
      
      ${paymentMethod ? `
        <div class="section">
          <div class="section-title">FORMA DE PAGAMENTO:</div>
          <div>${paymentMethod}</div>
        </div>
      ` : ''}
      
      <div class="declaration">
        Para maior clareza, firmo o presente recibo, dando plena, total e irrevogável quitação do valor acima especificado.
      </div>
      
      <div class="signature">
        <div class="signature-line"></div>
        <div class="signature-text">${data.clinic.name}</div>
        <div class="signature-text">Assinatura e Carimbo</div>
      </div>
      
      <div class="footer">
        Documento gerado eletronicamente pelo sistema Eclini<br>
        Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </div>
      
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
