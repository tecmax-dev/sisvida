import { useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Calendar, 
  Clock, 
  User, 
  Building2, 
  MapPin, 
  Phone,
  Download,
  Printer,
  Share2
} from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

interface HomologacaoProtocolReceiptProps {
  appointment: {
    id: string;
    protocol_number: string | null;
    confirmation_token: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    employee_name: string;
    employee_cpf: string | null;
    company_name: string;
    company_cnpj: string | null;
    company_phone: string;
    service_type?: {
      name: string;
    };
  };
  professional: {
    name: string;
    function: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state_code: string | null;
  };
  clinic?: {
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state_code: string | null;
  } | null;
}

export function HomologacaoProtocolReceipt({ 
  appointment, 
  professional, 
  clinic 
}: HomologacaoProtocolReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const protocolNumber = appointment.protocol_number || `HOM-${appointment.id.slice(0, 8).toUpperCase()}`;
  const validationUrl = `${window.location.origin}/protocolo/${appointment.confirmation_token}`;
  const address = professional.address || clinic?.address;
  const city = professional.city || clinic?.city;
  const stateCode = professional.state_code || clinic?.state_code;
  const clinicPhone = professional.phone || clinic?.phone;

  // Generate PDF for thermal printer (80mm width = ~226.77 points at 72 DPI)
  const generatePDF = () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200], // 80mm width, variable height
    });

    let y = 10;
    const marginX = 5;
    const contentWidth = 70;

    // Title
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PROTOCOLO DE ATENDIMENTO', 40, y, { align: 'center' });
    y += 8;

    // Protocol number
    pdf.setFontSize(16);
    pdf.text(protocolNumber, 40, y, { align: 'center' });
    y += 10;

    // Divider
    pdf.setLineWidth(0.5);
    pdf.line(marginX, y, 75, y);
    y += 6;

    // Appointment details
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const addLine = (label: string, value: string) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${label}:`, marginX, y);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(value, contentWidth - 25);
      pdf.text(lines, marginX + 25, y);
      y += 5 * lines.length;
    };

    addLine('Data', format(new Date(appointment.appointment_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }));
    addLine('Horário', `${appointment.start_time?.slice(0, 5)} - ${appointment.end_time?.slice(0, 5)}`);
    addLine('Profissional', professional.name);
    if (appointment.service_type?.name) {
      addLine('Serviço', appointment.service_type.name);
    }
    
    y += 3;
    pdf.line(marginX, y, 75, y);
    y += 6;

    // Employee/Company
    pdf.setFontSize(9);
    addLine('Funcionário', appointment.employee_name);
    if (appointment.employee_cpf) {
      addLine('CPF', appointment.employee_cpf);
    }
    addLine('Empresa', appointment.company_name);
    if (appointment.company_cnpj) {
      addLine('CNPJ', appointment.company_cnpj);
    }

    y += 3;
    pdf.line(marginX, y, 75, y);
    y += 6;

    // Address
    if (address) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('LOCAL:', marginX, y);
      y += 4;
      pdf.setFont('helvetica', 'normal');
      const addressText = `${address}${city ? `, ${city}` : ''}${stateCode ? ` - ${stateCode}` : ''}`;
      const addressLines = pdf.splitTextToSize(addressText, contentWidth);
      pdf.text(addressLines, marginX, y);
      y += 4 * addressLines.length + 3;
    }

    // QR Code placeholder (would need canvas for actual QR)
    y += 5;
    pdf.setFontSize(8);
    pdf.text('Escaneie para validar:', 40, y, { align: 'center' });
    y += 4;
    
    // Add QR code as image
    const qrCanvas = document.querySelector('#qr-code-svg canvas') as HTMLCanvasElement;
    if (qrCanvas) {
      const qrData = qrCanvas.toDataURL('image/png');
      pdf.addImage(qrData, 'PNG', 25, y, 30, 30);
      y += 35;
    } else {
      // Fallback: just show URL
      y += 5;
      pdf.text(validationUrl, 40, y, { align: 'center', maxWidth: 70 });
      y += 10;
    }

    // Footer
    y += 5;
    pdf.setFontSize(7);
    pdf.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 40, y, { align: 'center' });

    pdf.save(`protocolo-${protocolNumber}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  // Print receipt
  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Protocolo ${protocolNumber}</title>
        <style>
          @page { 
            size: 80mm auto; 
            margin: 0;
          }
          body { 
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            max-width: 80mm;
            margin: 0 auto;
          }
          .header { text-align: center; margin-bottom: 15px; }
          .protocol { font-size: 18px; font-weight: bold; margin: 10px 0; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .row { display: flex; margin: 5px 0; }
          .label { font-weight: bold; width: 80px; }
          .value { flex: 1; }
          .qr-container { text-align: center; margin: 15px 0; }
          .qr-code { width: 100px; height: 100px; }
          .footer { text-align: center; font-size: 10px; margin-top: 15px; }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Share
  const handleShare = async () => {
    const shareData = {
      title: `Protocolo ${protocolNumber}`,
      text: `Protocolo de Atendimento: ${protocolNumber}\nData: ${format(new Date(appointment.appointment_date + 'T12:00:00'), "dd/MM/yyyy")}\nHorário: ${appointment.start_time?.slice(0, 5)}`,
      url: validationUrl,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${shareData.text}\nValidação: ${shareData.url}`);
      toast.success("Link copiado para a área de transferência!");
    }
  };

  return (
    <div className="space-y-4">
      {/* Success message */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-emerald-800">Agendamento Confirmado!</h1>
        <p className="text-muted-foreground mt-1">Seu protocolo foi gerado com sucesso</p>
      </div>

      {/* Receipt card (printable) */}
      <Card className="max-w-sm mx-auto shadow-lg">
        <CardContent className="p-6" ref={receiptRef}>
          <div className="text-center space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Protocolo de Atendimento
            </h2>
            <p className="text-2xl font-bold font-mono">{protocolNumber}</p>
          </div>

          <div className="my-4 border-t border-dashed" />

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium">Data:</span>
              <span>{format(new Date(appointment.appointment_date + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium">Horário:</span>
              <span>{appointment.start_time?.slice(0, 5)} - {appointment.end_time?.slice(0, 5)}</span>
            </div>

            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium">Profissional:</span>
              <span>{professional.name}</span>
            </div>

            {appointment.service_type?.name && (
              <div className="flex items-start gap-2">
                <span className="font-medium ml-6">Serviço:</span>
                <span>{appointment.service_type.name}</span>
              </div>
            )}
          </div>

          <div className="my-4 border-t border-dashed" />

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{appointment.employee_name}</p>
                {appointment.employee_cpf && (
                  <p className="text-muted-foreground">CPF: {appointment.employee_cpf}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{appointment.company_name}</p>
                {appointment.company_cnpj && (
                  <p className="text-muted-foreground">CNPJ: {appointment.company_cnpj}</p>
                )}
              </div>
            </div>
          </div>

          <div className="my-4 border-t border-dashed" />

          {/* Address */}
          {address && (
            <div className="space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p>{address}</p>
                  {city && <p>{city}{stateCode && ` - ${stateCode}`}</p>}
                </div>
              </div>
              {clinicPhone && (
                <div className="flex items-center gap-2 ml-6">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <span>{clinicPhone}</span>
                </div>
              )}
            </div>
          )}

          <div className="my-4 border-t border-dashed" />

          {/* QR Code */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">Escaneie para validar o agendamento:</p>
            <div id="qr-code-svg" className="flex justify-center">
              <QRCodeSVG 
                value={validationUrl} 
                size={120}
                level="M"
                includeMargin
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            <p>Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
        <Button variant="outline" onClick={generatePDF}>
          <Download className="w-4 h-4 mr-2" />
          Baixar PDF
        </Button>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar
        </Button>
      </div>

      {/* Instructions */}
      <Card className="max-w-sm mx-auto bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <h3 className="font-medium text-amber-800 mb-2">⚠️ Importante</h3>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Apresente este protocolo no dia do atendimento</li>
            <li>• Chegue com 15 minutos de antecedência</li>
            <li>• Leve documento de identificação com foto</li>
            <li>• Em caso de cancelamento, avise com antecedência</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}