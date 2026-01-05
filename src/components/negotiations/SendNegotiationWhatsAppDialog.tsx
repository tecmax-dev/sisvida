import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, MessageCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function parseDateOnly(value: string): Date {
  const d = parseISO(value);
  // Avoid timezone shift when backend stores date-only strings (YYYY-MM-DD)
  d.setHours(12, 0, 0, 0);
  return d;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  phone?: string | null;
}

interface NegotiationItem {
  contribution_type_name: string;
  competence_month: number;
  competence_year: number;
  original_value: number;
  total_value: number;
  due_date: string;
  days_overdue: number;
  interest_value: number;
  correction_value: number;
  late_fee_value: number;
}

interface Installment {
  installment_number: number;
  value: number;
  due_date: string;
  status: string;
}

interface Negotiation {
  id: string;
  negotiation_code: string;
  status: string;
  total_original_value: number;
  total_interest: number;
  total_monetary_correction: number;
  total_late_fee: number;
  total_negotiated_value: number;
  installments_count: number;
  installment_value: number;
  first_due_date: string;
  down_payment_value: number;
  applied_interest_rate: number;
  applied_correction_rate: number;
  applied_late_fee_rate: number;
  employers?: Employer;
}

interface Clinic {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
}

interface SendNegotiationWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negotiation: Negotiation;
  items: NegotiationItem[];
  installments: Installment[];
  clinicId: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_LABELS: Record<string, string> = {
  simulation: "Simulação",
  pending_approval: "Aguardando Aprovação",
  approved: "Aprovado",
  active: "Ativo",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function SendNegotiationWhatsAppDialog({
  open,
  onOpenChange,
  negotiation,
  items,
  installments,
  clinicId,
}: SendNegotiationWhatsAppDialogProps) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [clinic, setClinic] = useState<Clinic | null>(null);

  useEffect(() => {
    if (open) {
      if (negotiation.employers?.phone) {
        setPhone(formatPhone(negotiation.employers.phone));
      }
      fetchClinic();
    }
  }, [open, negotiation.employers?.phone, clinicId]);

  const fetchClinic = async () => {
    const { data } = await supabase
      .from("clinics")
      .select("id, name, cnpj, address, logo_url, phone, email")
      .eq("id", clinicId)
      .single();
    if (data) setClinic(data);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const generatePDFBase64 = async (): Promise<string> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const primaryColor: [number, number, number] = [37, 99, 235];
    const darkColor: [number, number, number] = [30, 41, 59];
    const grayColor: [number, number, number] = [100, 116, 139];
    const successColor: [number, number, number] = [22, 163, 74];
    const lightBg: [number, number, number] = [248, 250, 252];

    let startY = 15;

    // Try to load logo
    let logoBase64: string | null = null;
    if (clinic?.logo_url) {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-image-base64", {
          body: { url: clinic.logo_url },
        });
        if (!error && data?.base64) {
          logoBase64 = data.base64;
        }
      } catch (err) {
        console.error("Error loading logo:", err);
      }
    }

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 45, "F");

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", 14, 8, 30, 30);
      } catch (e) {
        console.error("Error adding logo:", e);
      }
    }

    const headerX = logoBase64 ? 50 : 14;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(clinic?.name || "Entidade Sindical", headerX, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (clinic?.cnpj) {
      doc.text(`CNPJ: ${formatCNPJ(clinic.cnpj)}`, headerX, 27);
    }
    if (clinic?.phone || clinic?.email) {
      doc.text([clinic.phone, clinic.email].filter(Boolean).join(" | "), headerX, 33);
    }
    if (clinic?.address) {
      doc.text(clinic.address.substring(0, 80), headerX, 39);
    }

    // Badge
    doc.setFillColor(...darkColor);
    doc.roundedRect(pageWidth - 75, 10, 61, 25, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ESPELHO DE NEGOCIAÇÃO", pageWidth - 44.5, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text(negotiation.negotiation_code, pageWidth - 44.5, 28, { align: "center" });

    // Info bar
    doc.setFillColor(...lightBg);
    doc.rect(0, 48, pageWidth, 14, "F");
    doc.setTextColor(...grayColor);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${STATUS_LABELS[negotiation.status] || "Simulação"}`, 14, 56);
    doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - 14, 56, { align: "right" });

    startY = 70;

    // Contribuinte card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, startY - 5, pageWidth - 28, 30, 2, 2, "FD");
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRIBUINTE", 20, startY + 3);
    
    doc.setTextColor(...darkColor);
    doc.setFontSize(11);
    doc.text(negotiation.employers?.name || "-", 20, startY + 12);
    
    doc.setTextColor(...grayColor);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (negotiation.employers?.cnpj) {
      doc.text(`CNPJ: ${formatCNPJ(negotiation.employers.cnpj)}`, 20, startY + 20);
    }

    startY += 35;

    // Contributions table
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRIBUIÇÕES NEGOCIADAS", 14, startY);
    startY += 4;

    const contributionsData = items.map((item) => [
      item.contribution_type_name || "-",
      `${MONTHS[item.competence_month - 1]}/${item.competence_year}`,
      format(parseDateOnly(item.due_date), "dd/MM/yyyy"),
      formatCurrency(item.original_value),
      `${item.days_overdue}`,
      formatCurrency(item.interest_value + item.correction_value + item.late_fee_value),
      formatCurrency(item.total_value),
    ]);

    autoTable(doc, {
      startY,
      head: [["Tipo", "Competência", "Vencimento", "Original", "Dias", "Encargos", "Total"]],
      body: contributionsData,
      theme: "grid",
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
      bodyStyles: { fontSize: 8, textColor: darkColor },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "center" }, 5: { halign: "right" }, 6: { halign: "right", fontStyle: "bold" } },
      styles: { cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.5 },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Financial summary
    doc.setFillColor(...lightBg);
    doc.roundedRect(14, currentY, pageWidth - 28, 55, 3, 3, "F");
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(1);
    doc.line(14, currentY, 14, currentY + 55);

    currentY += 8;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO FINANCEIRO", 22, currentY);
    currentY += 8;

    const summaryItems = [
      { label: "Valor Original Total", value: formatCurrency(negotiation.total_original_value) },
      { label: "Juros Aplicados", value: formatCurrency(negotiation.total_interest), sub: `${negotiation.applied_interest_rate}% a.m.` },
      { label: "Correção Monetária", value: formatCurrency(negotiation.total_monetary_correction), sub: `${negotiation.applied_correction_rate}%` },
      { label: "Multa Moratória", value: formatCurrency(negotiation.total_late_fee), sub: `${negotiation.applied_late_fee_rate}%` },
    ];

    doc.setFontSize(9);
    summaryItems.forEach((item) => {
      doc.setTextColor(...grayColor);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, 22, currentY);
      doc.setTextColor(...darkColor);
      doc.setFont("helvetica", "bold");
      doc.text(item.value, pageWidth - 22, currentY, { align: "right" });
      if (item.sub) {
        doc.setTextColor(...grayColor);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`(${item.sub})`, pageWidth - 22 - doc.getTextWidth(item.value) - 3, currentY);
        doc.setFontSize(9);
      }
      currentY += 7;
    });

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(22, currentY - 2, pageWidth - 22, currentY - 2);
    currentY += 4;
    doc.setTextColor(...successColor);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("VALOR TOTAL NEGOCIADO", 22, currentY);
    doc.text(formatCurrency(negotiation.total_negotiated_value), pageWidth - 22, currentY, { align: "right" });

    currentY = (doc as any).lastAutoTable.finalY + 75;

    // Conditions
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 35, 2, 2, "FD");

    currentY += 8;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CONDIÇÕES DO PARCELAMENTO", 22, currentY);
    currentY += 10;

    const conditionsCols = [
      { label: "Entrada", value: formatCurrency(negotiation.down_payment_value || 0) },
      { label: "Parcelas", value: `${negotiation.installments_count}x` },
      { label: "Valor Parcela", value: formatCurrency(negotiation.installment_value) },
      { label: "1º Vencimento", value: format(parseDateOnly(negotiation.first_due_date), "dd/MM/yyyy") },
    ];

    const colWidth = (pageWidth - 44) / 4;
    conditionsCols.forEach((col, idx) => {
      const x = 22 + (idx * colWidth);
      doc.setTextColor(...grayColor);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(col.label, x, currentY);
      doc.setTextColor(...darkColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(col.value, x, currentY + 8);
    });

    currentY += 30;

    // Installments
    if (installments.length > 0 && currentY < pageHeight - 60) {
      doc.setTextColor(...primaryColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("CRONOGRAMA DE PARCELAS", 14, currentY);
      currentY += 4;

      const scheduleData = installments.map((inst) => [
        `${inst.installment_number}ª Parcela`,
        format(parseDateOnly(inst.due_date), "dd/MM/yyyy"),
        formatCurrency(inst.value),
        inst.status === "paid" ? "Pago" : inst.status === "overdue" ? "Vencido" : "Pendente",
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Parcela", "Vencimento", "Valor", "Status"]],
        body: scheduleData,
        theme: "grid",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
        bodyStyles: { fontSize: 8, textColor: darkColor, halign: "center" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.5 },
      });
    }

    // Footer
    const footerY = pageHeight - 15;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
    doc.setTextColor(...grayColor);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Documento gerado eletronicamente. Este espelho é válido para conferência dos valores negociados.", pageWidth / 2, footerY, { align: "center" });
    doc.text(`${clinic?.name || ""} - ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, footerY + 4, { align: "center" });

    // Convert to base64
    const pdfOutput = doc.output("datauristring");
    const base64 = pdfOutput.split(",")[1];
    return base64;
  };

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Digite um número de telefone válido");
      return;
    }

    setSending(true);

    try {
      // Generate PDF
      toast.info("Gerando PDF...");
      const pdfBase64 = await generatePDFBase64();
      const fileName = `espelho-negociacao-${negotiation.negotiation_code}.pdf`;

      // Caption for the document
      let caption = `📋 *ESPELHO DE NEGOCIAÇÃO*\n\n`;
      caption += `🏢 *Empresa:* ${negotiation.employers?.name || "N/A"}\n`;
      caption += `🔢 *Código:* ${negotiation.negotiation_code}\n\n`;
      caption += `💰 *Valor Negociado:* ${formatCurrency(negotiation.total_negotiated_value)}\n`;
      caption += `📅 *Parcelas:* ${negotiation.installments_count}x de ${formatCurrency(negotiation.installment_value)}\n`;
      caption += `📆 *1ª Parcela:* ${format(parseDateOnly(negotiation.first_due_date), "dd/MM/yyyy")}\n\n`;
      caption += `_Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}_`;

      // Send document via WhatsApp
      const { data, error } = await supabase.functions.invoke("send-whatsapp-document", {
        body: {
          phone: cleanPhone,
          clinicId,
          pdfBase64,
          fileName,
          caption,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao enviar");

      toast.success("Espelho enviado com sucesso via WhatsApp!");
      onOpenChange(false);
      setPhone("");
    } catch (error: any) {
      console.error("Erro ao enviar:", error);
      toast.error(error.message || "Erro ao enviar via WhatsApp");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Enviar Espelho via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie o espelho da negociação em PDF para o contribuinte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={16}
            />
          </div>

          <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
            <div className="flex items-center gap-2 text-primary font-medium">
              <FileText className="h-4 w-4" />
              Será enviado como PDF anexo
            </div>
            <p><strong>Empresa:</strong> {negotiation.employers?.name}</p>
            <p><strong>Código:</strong> {negotiation.negotiation_code}</p>
            <p><strong>Valor:</strong> {formatCurrency(negotiation.total_negotiated_value)}</p>
            <p><strong>Parcelas:</strong> {negotiation.installments_count}x de {formatCurrency(negotiation.installment_value)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || phone.replace(/\D/g, "").length < 10}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
