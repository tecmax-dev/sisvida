import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Receipt,
  Printer,
  MessageCircle,
} from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SendNegotiationWhatsAppDialog } from "./SendNegotiationWhatsAppDialog";
import EditNegotiationDialog from "./EditNegotiationDialog";
import { Pencil } from "lucide-react";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
}

interface Negotiation {
  id: string;
  negotiation_code: string;
  status: string;
  employer_id: string;
  total_original_value: number;
  total_interest: number;
  total_monetary_correction: number;
  total_late_fee: number;
  total_negotiated_value: number;
  down_payment_value: number;
  down_payment_due_date: string | null;
  installments_count: number;
  installment_value: number;
  first_due_date: string;
  applied_interest_rate: number;
  applied_correction_rate: number;
  applied_late_fee_rate: number;
  approved_at: string | null;
  approved_by: string | null;
  approval_method: string | null;
  approval_notes: string | null;
  finalized_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  employers?: Employer;
}

interface NegotiationItem {
  id: string;
  contribution_id: string;
  original_value: number;
  due_date: string;
  competence_month: number;
  competence_year: number;
  contribution_type_name: string;
  days_overdue: number;
  interest_value: number;
  correction_value: number;
  late_fee_value: number;
  total_value: number;
}

interface Installment {
  id: string;
  installment_number: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_url: string | null;
  paid_at: string | null;
  paid_value: number | null;
}

interface NegotiationDetailsDialogProps {
  negotiation: Negotiation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  simulation: { label: "Simulação", badgeClass: "bg-purple-500/15 text-purple-700" },
  pending_approval: { label: "Aguardando Aprovação", badgeClass: "bg-amber-500/15 text-amber-700" },
  approved: { label: "Aprovado", badgeClass: "bg-blue-500/15 text-blue-700" },
  active: { label: "Ativo", badgeClass: "bg-emerald-500/15 text-emerald-700" },
  completed: { label: "Concluído", badgeClass: "bg-green-500/15 text-green-700" },
  cancelled: { label: "Cancelado", badgeClass: "bg-gray-500/15 text-gray-500" },
};

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export default function NegotiationDetailsDialog({
  negotiation,
  open,
  onOpenChange,
  onRefresh,
}: NegotiationDetailsDialogProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<NegotiationItem[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Approval dialog
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalMethod, setApprovalMethod] = useState<string>("presencial");
  const [approvalNotes, setApprovalNotes] = useState("");

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // WhatsApp dialog
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);

  // Edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Local copy (ensures latest DB values after edits)
  const [currentNegotiation, setCurrentNegotiation] = useState<Negotiation>(negotiation);

  // Clinic info for PDF
  const [clinic, setClinic] = useState<{ id: string; name: string; cnpj: string | null; address: string | null; logo_url: string | null; phone: string | null; email: string | null } | null>(null);

  useEffect(() => {
    setCurrentNegotiation(negotiation);
  }, [negotiation]);

  useEffect(() => {
    if (open && negotiation.id) {
      fetchDetails();
    }
  }, [open, negotiation.id]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [itemsRes, installmentsRes, negotiationRes, clinicRes] = await Promise.all([
        supabase
          .from("negotiation_items")
          .select("*")
          .eq("negotiation_id", negotiation.id)
          .order("competence_year", { ascending: true })
          .order("competence_month", { ascending: true }),
        supabase
          .from("negotiation_installments")
          .select("*")
          .eq("negotiation_id", negotiation.id)
          .order("installment_number", { ascending: true }),
        supabase
          .from("debt_negotiations")
          .select(`*, employers (id, name, cnpj, trade_name)`)
          .eq("id", negotiation.id)
          .single(),
        supabase
          .from("debt_negotiations")
          .select("clinic_id")
          .eq("id", negotiation.id)
          .single()
          .then(async (res) => {
            if (res.data?.clinic_id) {
              return supabase
                .from("clinics")
                .select("id, name, cnpj, address, logo_url, phone, email")
                .eq("id", res.data.clinic_id)
                .single();
            }
            return { data: null, error: null };
          }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (installmentsRes.error) throw installmentsRes.error;
      if (negotiationRes.error) throw negotiationRes.error;

      setItems(itemsRes.data || []);
      setInstallments(installmentsRes.data || []);
      if (negotiationRes.data) setCurrentNegotiation(negotiationRes.data as unknown as Negotiation);
      if (clinicRes.data) setClinic(clinicRes.data);
    } catch (error) {
      console.error("Error fetching details:", error);
      toast.error("Erro ao carregar detalhes");
    } finally {
      setLoading(false);
    }
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

  const handleSendForApproval = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("debt_negotiations")
        .update({ status: "pending_approval" })
        .eq("id", negotiation.id);

      if (error) throw error;

      toast.success("Negociação enviada para aprovação");
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao enviar para aprovação");
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("debt_negotiations")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
          approval_method: approvalMethod,
          approval_notes: approvalNotes || null,
        })
        .eq("id", negotiation.id);

      if (error) throw error;

      toast.success("Negociação aprovada com sucesso");
      setShowApprovalDialog(false);
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao aprovar negociação");
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalize = async () => {
    setProcessing(true);
    try {
      // Update negotiation status
      const { error: negError } = await supabase
        .from("debt_negotiations")
        .update({
          status: "active",
          finalized_at: new Date().toISOString(),
          finalized_by: user?.id,
        })
        .eq("id", negotiation.id);

      if (negError) throw negError;

      // Update original contributions to mark as negotiated
      const contributionIds = items.map((item) => item.contribution_id);
      const { error: contribError } = await supabase
        .from("employer_contributions")
        .update({
          negotiation_id: negotiation.id,
          status: "negotiated",
        })
        .in("id", contributionIds);

      if (contribError) throw contribError;

      // Generate boleto for down payment if exists
      if (currentNegotiation.down_payment_value && currentNegotiation.down_payment_value > 0) {
        try {
          // Keep date stable (avoid timezone shifts)
          const downPaymentDateOnly = (currentNegotiation.down_payment_due_date
            ? currentNegotiation.down_payment_due_date
            : format(new Date(), "yyyy-MM-dd")).split("T")[0];

          // Send as ISO at noon to avoid timezone day-shift in external providers
          const downPaymentDueDate = `${downPaymentDateOnly}T12:00:00`;

          const { error: downPaymentError } = await supabase.functions.invoke("lytex-api", {
            body: {
              action: "createInvoice",
              clientId: currentNegotiation.employers?.id,
              clientName: currentNegotiation.employers?.name,
              clientDocument: currentNegotiation.employers?.cnpj,
              value: currentNegotiation.down_payment_value,
              dueDate: downPaymentDueDate,
              description: `Negociação ${currentNegotiation.negotiation_code} - ENTRADA`,
            },
          });

          if (downPaymentError) {
            console.error("Error generating down payment boleto:", downPaymentError);
          }
        } catch (err) {
          console.error("Error invoking lytex-api for down payment:", err);
        }
      }

      // Generate boletos for installments
      for (const installment of installments) {
        try {
          const installmentDateOnly = `${installment.due_date}`.split("T")[0];
          const installmentDueDate = `${installmentDateOnly}T12:00:00`;

          const { error: boletoError } = await supabase.functions.invoke("lytex-api", {
            body: {
              action: "createInvoice",
              clientId: currentNegotiation.employers?.id,
              clientName: currentNegotiation.employers?.name,
              clientDocument: currentNegotiation.employers?.cnpj,
              value: installment.value,
              dueDate: installmentDueDate,
              description: `Negociação ${currentNegotiation.negotiation_code} - Parcela ${installment.installment_number}/${currentNegotiation.installments_count}`,
            },
          });

          if (boletoError) {
            console.error("Error generating boleto:", boletoError);
          }
        } catch (err) {
          console.error("Error invoking lytex-api:", err);
        }
      }

      toast.success("Negociação efetivada! Boletos estão sendo gerados.");
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao efetivar negociação");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }

    setProcessing(true);
    try {
      // Update negotiation
      const { error: negError } = await supabase
        .from("debt_negotiations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancellation_reason: cancelReason,
        })
        .eq("id", negotiation.id);

      if (negError) throw negError;

      // Reopen original contributions if they were marked as negotiated
      if (negotiation.status === "active") {
        const contributionIds = items.map((item) => item.contribution_id);
        const { error: contribError } = await supabase
          .from("employer_contributions")
          .update({
            negotiation_id: null,
            status: "overdue",
          })
          .in("id", contributionIds);

        if (contribError) throw contribError;
      }

      toast.success("Negociação cancelada");
      setShowCancelDialog(false);
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao cancelar negociação");
    } finally {
      setProcessing(false);
    }
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const MONTHS_FULL = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    // Colors
    const primaryColor: [number, number, number] = [37, 99, 235]; // Blue 600
    const darkColor: [number, number, number] = [30, 41, 59]; // Slate 800
    const grayColor: [number, number, number] = [100, 116, 139]; // Slate 500
    const successColor: [number, number, number] = [22, 163, 74]; // Green 600
    const lightBg: [number, number, number] = [248, 250, 252]; // Slate 50

    let startY = 15;

    // Try to load clinic logo
    let logoBase64: string | null = null;
    const logoUrl = clinic?.logo_url;
    if (logoUrl) {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-image-base64", {
          body: { url: logoUrl },
        });
        if (!error && data?.base64) {
          logoBase64 = data.base64;
        }
      } catch (err) {
        console.error("Error loading logo:", err);
      }
    }

    // Header with gradient effect simulation
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 45, "F");

    // Logo or clinic name
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", 14, 8, 30, 30);
        startY = 12;
      } catch (e) {
        console.error("Error adding logo:", e);
      }
    }

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const headerX = logoBase64 ? 50 : 14;
    doc.text(clinic?.name || "Entidade Sindical", headerX, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (clinic?.cnpj) {
      doc.text(`CNPJ: ${formatCNPJ(clinic.cnpj)}`, headerX, 27);
    }
    if (clinic?.phone || clinic?.email) {
      const contactInfo = [clinic.phone, clinic.email].filter(Boolean).join(" | ");
      doc.text(contactInfo, headerX, 33);
    }
    if (clinic?.address) {
      doc.text(clinic.address.substring(0, 80), headerX, 39);
    }

    // Document title badge
    doc.setFillColor(...darkColor);
    doc.roundedRect(pageWidth - 75, 10, 61, 25, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ESPELHO DE NEGOCIAÇÃO", pageWidth - 44.5, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text(negotiation.negotiation_code, pageWidth - 44.5, 28, { align: "center" });

    startY = 55;

    // Status and date info bar
    doc.setFillColor(...lightBg);
    doc.rect(0, 48, pageWidth, 14, "F");
    doc.setTextColor(...grayColor);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const statusLabel = STATUS_CONFIG[negotiation.status]?.label || "Simulação";
    doc.text(`Status: ${statusLabel}`, 14, 56);
    doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - 14, 56, { align: "right" });

    startY = 70;

    // Section: Contribuinte (styled card)
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
    const cnpjText = negotiation.employers?.cnpj ? `CNPJ: ${formatCNPJ(negotiation.employers.cnpj)}` : "";
    doc.text(cnpjText, 20, startY + 20);

    startY += 35;

    // Section: Contribuições Negociadas
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRIBUIÇÕES NEGOCIADAS", 14, startY);
    startY += 4;

    const contributionsData = items.map((item) => [
      item.contribution_type_name || "-",
      `${MONTHS_FULL[item.competence_month - 1]}/${item.competence_year}`,
      format(new Date(item.due_date), "dd/MM/yyyy"),
      formatCurrency(item.original_value),
      `${item.days_overdue}`,
      formatCurrency(item.interest_value + item.correction_value + item.late_fee_value),
      formatCurrency(item.total_value),
    ]);

    autoTable(doc, {
      startY,
      head: [["Tipo", "Competência", "Vencimento", "Valor Original", "Dias Atraso", "Encargos", "Total c/ Encargos"]],
      body: contributionsData,
      theme: "grid",
      headStyles: { 
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: darkColor,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 30 },
        3: { halign: "right" },
        4: { halign: "center" },
        5: { halign: "right" },
        6: { halign: "right", fontStyle: "bold" },
      },
      styles: {
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Financial Summary Card (highlighted)
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
    summaryItems.forEach((item, idx) => {
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

    // Total line
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

    // Condições do Parcelamento
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
      { label: "1º Vencimento", value: format(new Date(negotiation.first_due_date), "dd/MM/yyyy") },
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

    // Installments schedule if available
    if (installments.length > 0 && currentY < pageHeight - 60) {
      doc.setTextColor(...primaryColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("CRONOGRAMA DE PARCELAS", 14, currentY);
      currentY += 4;

      const scheduleData = installments.map((inst) => [
        `${inst.installment_number}ª Parcela`,
        format(new Date(inst.due_date), "dd/MM/yyyy"),
        formatCurrency(inst.value),
        inst.status === "paid" ? "Pago" : inst.status === "overdue" ? "Vencido" : "Pendente",
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Parcela", "Vencimento", "Valor", "Status"]],
        body: scheduleData,
        theme: "grid",
        headStyles: { 
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: darkColor,
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        styles: {
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
        },
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

    doc.save(`espelho-negociacao-${negotiation.negotiation_code}-${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const handlePrint = async () => {
    await handleExportPDF();
  };

  const statusConfig = STATUS_CONFIG[negotiation.status] || STATUS_CONFIG.simulation;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">
                  {negotiation.negotiation_code}
                </DialogTitle>
                <DialogDescription>
                  {negotiation.employers?.name}
                </DialogDescription>
              </div>
              <Badge variant="outline" className={statusConfig.badgeClass}>
                {statusConfig.label}
              </Badge>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="summary">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Resumo</TabsTrigger>
                <TabsTrigger value="items">Contribuições</TabsTrigger>
                <TabsTrigger value="installments">Parcelas</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4 mt-4">
                {/* Company Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Contribuinte
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{negotiation.employers?.name}</p>
                      <p className="text-muted-foreground font-mono">
                        {negotiation.employers?.cnpj && formatCNPJ(negotiation.employers.cnpj)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Resumo Financeiro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Valor Original</span>
                      <span>{formatCurrency(negotiation.total_original_value)}</span>
                    </div>
                    <div className="flex justify-between text-amber-600">
                      <span>Juros ({negotiation.applied_interest_rate}%)</span>
                      <span>+{formatCurrency(negotiation.total_interest)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>Correção ({negotiation.applied_correction_rate}%)</span>
                      <span>+{formatCurrency(negotiation.total_monetary_correction)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Multa ({negotiation.applied_late_fee_rate}%)</span>
                      <span>+{formatCurrency(negotiation.total_late_fee)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                      <span>Total Negociado</span>
                      <span className="text-primary">{formatCurrency(negotiation.total_negotiated_value)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Installment Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Parcelamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {negotiation.down_payment_value > 0 && (
                      <div className="flex justify-between">
                        <span>Entrada</span>
                        <span>{formatCurrency(negotiation.down_payment_value)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Parcelas</span>
                      <span>{negotiation.installments_count}x de {formatCurrency(negotiation.installment_value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Primeira Parcela</span>
                      <span>{format(new Date(negotiation.first_due_date), "dd/MM/yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Approval Info */}
                {negotiation.approved_at && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Aprovação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Data</span>
                        <span>{format(new Date(negotiation.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Método</span>
                        <span className="capitalize">{negotiation.approval_method}</span>
                      </div>
                      {negotiation.approval_notes && (
                        <p className="text-muted-foreground italic">{negotiation.approval_notes}</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="items" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-center">Atraso</TableHead>
                      <TableHead className="text-right">Encargos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.contribution_type_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {MONTHS[item.competence_month - 1]}/{item.competence_year}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.original_value)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive" className="text-xs">{item.days_overdue}d</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(item.interest_value + item.correction_value + item.late_fee_value)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total_value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="installments" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installment_number}/{negotiation.installments_count}</TableCell>
                        <TableCell>{format(new Date(inst.due_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-right">{formatCurrency(inst.value)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              inst.status === "paid"
                                ? "bg-emerald-500/15 text-emerald-700"
                                : inst.status === "overdue"
                                ? "bg-rose-500/15 text-rose-700"
                                : "bg-amber-500/15 text-amber-700"
                            }
                          >
                            {inst.status === "paid" ? "Pago" : inst.status === "overdue" ? "Vencido" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {inst.lytex_invoice_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(inst.lytex_invoice_url!, "_blank")}
                            >
                              <Receipt className="h-4 w-4 mr-1" />
                              Boleto
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <div className="flex gap-2">
              {negotiation.status !== "cancelled" && negotiation.status !== "completed" && (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {/* Edit button - only for simulation or pending_approval */}
              {(currentNegotiation.status === "simulation" || currentNegotiation.status === "pending_approval") && (
                <Button variant="outline" onClick={() => setShowEditDialog(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}

              {/* Print and WhatsApp buttons - always available */}
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowWhatsAppDialog(true)}
                className="text-emerald-600 hover:text-emerald-700"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>

              {currentNegotiation.status === "simulation" && (
                <Button onClick={handleSendForApproval} disabled={processing}>
                  {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar para Aprovação
                </Button>
              )}
              {currentNegotiation.status === "pending_approval" && (
                <Button onClick={() => setShowApprovalDialog(true)} disabled={processing}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
              )}
              {currentNegotiation.status === "approved" && (
                <Button onClick={handleFinalize} disabled={processing}>
                  {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Efetivar e Gerar Boletos
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Dialog */}
      <SendNegotiationWhatsAppDialog
        open={showWhatsAppDialog}
        onOpenChange={setShowWhatsAppDialog}
        negotiation={negotiation}
        items={items}
        installments={installments}
        clinicId={clinic?.id || ""}
      />

      {/* Edit Dialog */}
      <EditNegotiationDialog
        negotiation={currentNegotiation}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => {
          fetchDetails();
          onRefresh();
        }}
      />
      {/* Approval Dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Negociação</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme a aprovação da negociação pelo contribuinte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Forma de Aceite</Label>
              <Select value={approvalMethod} onValueChange={setApprovalMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Aceite Presencial</SelectItem>
                  <SelectItem value="portal">Portal da Empresa</SelectItem>
                  <SelectItem value="documento_assinado">Documento Assinado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Informações adicionais sobre a aprovação..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Negociação</AlertDialogTitle>
            <AlertDialogDescription>
              {negotiation.status === "active"
                ? "As contribuições originais serão reabertas como débitos em atraso."
                : "Esta ação não poderá ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo do Cancelamento *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo do cancelamento..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={processing || !cancelReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
