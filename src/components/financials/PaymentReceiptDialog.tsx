import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PaymentReceiptPreview } from "./PaymentReceiptPreview";
import {
  generatePaymentReceiptPDF,
  printReceipt,
  formatReceiptNumber,
  PaymentReceiptData,
} from "@/lib/paymentReceiptUtils";
import { sendWhatsAppDocument, formatPaymentReceipt } from "@/lib/whatsapp";
import { toast } from "sonner";
import { Printer, Download, MessageCircle, Loader2 } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  payment_method?: string | null;
  paid_date?: string | null;
  patient_id?: string | null;
  procedure_id?: string | null;
  professional_id?: string | null;
  patients?: { name: string; cpf?: string | null; phone?: string | null } | null;
  procedures?: { name: string } | null;
  professionals?: { name: string } | null;
}

interface PaymentReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  clinicId: string;
}

export function PaymentReceiptDialog({
  open,
  onOpenChange,
  transaction,
  clinicId,
}: PaymentReceiptDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [receiptNumber] = useState(() => formatReceiptNumber(clinicId));

  // Fetch clinic data
  const { data: clinic } = useQuery({
    queryKey: ["clinic", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("name, address, phone, cnpj, logo_url")
        .eq("id", clinicId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!clinicId,
  });

  // Fetch patient data if available
  const { data: patient } = useQuery({
    queryKey: ["patient-receipt", transaction.patient_id],
    queryFn: async () => {
      if (!transaction.patient_id) return null;
      const { data, error } = await supabase
        .from("patients")
        .select("name, cpf, phone")
        .eq("id", transaction.patient_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!transaction.patient_id,
  });

  // Fetch procedure name if available
  const { data: procedure } = useQuery({
    queryKey: ["procedure-receipt", transaction.procedure_id],
    queryFn: async () => {
      if (!transaction.procedure_id) return null;
      const { data, error } = await supabase
        .from("procedures")
        .select("name")
        .eq("id", transaction.procedure_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!transaction.procedure_id,
  });

  // Fetch professional name if available
  const { data: professional } = useQuery({
    queryKey: ["professional-receipt", transaction.professional_id],
    queryFn: async () => {
      if (!transaction.professional_id) return null;
      const { data, error } = await supabase
        .from("professionals")
        .select("name")
        .eq("id", transaction.professional_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!transaction.professional_id,
  });

  // Set default phone when patient data is available
  useEffect(() => {
    if (patient?.phone) {
      setWhatsappPhone(patient.phone);
    }
  }, [patient]);

  const getReceiptData = (): PaymentReceiptData | null => {
    if (!clinic) return null;

    return {
      clinic: {
        name: clinic.name,
        address: clinic.address,
        phone: clinic.phone,
        cnpj: clinic.cnpj,
        logo_url: clinic.logo_url,
      },
      patient: patient
        ? {
            name: patient.name,
            cpf: patient.cpf,
          }
        : undefined,
      transaction: {
        id: transaction.id,
        description: transaction.description,
        amount: Number(transaction.amount),
        payment_method: transaction.payment_method,
        paid_date: transaction.paid_date,
        procedure_name: procedure?.name,
        professional_name: professional?.name,
      },
      receiptNumber,
    };
  };

  const handlePrint = () => {
    const data = getReceiptData();
    if (!data) {
      toast.error("Dados da clínica não carregados");
      return;
    }
    printReceipt(data);
  };

  const handleDownload = async () => {
    const data = getReceiptData();
    if (!data) {
      toast.error("Dados da clínica não carregados");
      return;
    }

    setIsGenerating(true);
    try {
      const { blob, fileName } = await generatePaymentReceiptPDF(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Recibo baixado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF do recibo");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappPhone) {
      toast.error("Informe o número do WhatsApp");
      return;
    }

    const data = getReceiptData();
    if (!data) {
      toast.error("Dados da clínica não carregados");
      return;
    }

    setIsSending(true);
    try {
      const { base64, fileName } = await generatePaymentReceiptPDF(data);
      
      const caption = formatPaymentReceipt(
        patient?.name || "Cliente",
        clinic!.name,
        new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(Number(transaction.amount)),
        transaction.description,
        transaction.paid_date || new Date().toISOString().split("T")[0]
      );

      const result = await sendWhatsAppDocument({
        phone: whatsappPhone,
        clinicId,
        pdfBase64: base64,
        fileName,
        caption,
      });

      if (result.success) {
        toast.success("Recibo enviado por WhatsApp com sucesso!");
        setShowWhatsAppForm(false);
      } else {
        toast.error(result.error || "Erro ao enviar recibo por WhatsApp");
      }
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      toast.error("Erro ao enviar recibo por WhatsApp");
    } finally {
      setIsSending(false);
    }
  };

  if (!clinic) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recibo de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Recibo de Pagamento</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <PaymentReceiptPreview
            clinic={{
              name: clinic.name,
              address: clinic.address,
              phone: clinic.phone,
              cnpj: clinic.cnpj,
            }}
            patient={
              patient
                ? {
                    name: patient.name,
                    cpf: patient.cpf,
                  }
                : undefined
            }
            transaction={{
              description: transaction.description,
              amount: Number(transaction.amount),
              payment_method: transaction.payment_method,
              paid_date: transaction.paid_date,
              procedure_name: procedure?.name,
              professional_name: professional?.name,
            }}
            receiptNumber={receiptNumber}
          />
        </ScrollArea>

        <Separator className="my-4" />

        {showWhatsAppForm ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="whatsapp-phone">Número do WhatsApp</Label>
              <Input
                id="whatsapp-phone"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowWhatsAppForm(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendWhatsApp}
                disabled={isSending || !whatsappPhone}
                className="flex-1"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar PDF
            </Button>
            <Button
              onClick={() => setShowWhatsAppForm(true)}
              className="flex-1"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar WhatsApp
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
