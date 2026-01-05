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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageCircle, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function parseDateOnly(value: string): Date {
  // Handles both DATE (YYYY-MM-DD) and TIMESTAMP strings safely
  const dateOnly = value?.slice(0, 10);
  const d = parseISO(dateOnly);
  d.setHours(12, 0, 0, 0);
  return d;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  phone?: string | null;
}

interface Installment {
  id: string;
  installment_number: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_url: string | null;
}

interface Negotiation {
  id: string;
  negotiation_code: string;
  total_negotiated_value: number;
  installments_count: number;
  employers?: Employer;
  down_payment_value?: number;
  down_payment_due_date?: string | null;
}

interface SendBoletosWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negotiation: Negotiation;
  installments: Installment[];
  clinicId: string;
}

export function SendBoletosWhatsAppDialog({
  open,
  onOpenChange,
  negotiation,
  installments,
  clinicId,
}: SendBoletosWhatsAppDialogProps) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState<string[]>([]);
  const [clinicName, setClinicName] = useState("");

  // Filter installments that have boleto URL and are not paid
  const availableInstallments = installments.filter(
    (inst) => inst.lytex_invoice_url && inst.status !== "paid"
  );

  useEffect(() => {
    if (open) {
      if (negotiation.employers?.phone) {
        setPhone(formatPhone(negotiation.employers.phone));
      }
      // Select all available installments by default
      setSelectedInstallments(availableInstallments.map((inst) => inst.id));
      fetchClinicName();
    }
  }, [open]);

  const fetchClinicName = async () => {
    const { data } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinicId)
      .single();
    if (data) setClinicName(data.name);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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

  const toggleInstallment = (id: string) => {
    setSelectedInstallments((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedInstallments.length === availableInstallments.length) {
      setSelectedInstallments([]);
    } else {
      setSelectedInstallments(availableInstallments.map((inst) => inst.id));
    }
  };

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Digite um número de telefone válido");
      return;
    }

    if (selectedInstallments.length === 0) {
      toast.error("Selecione pelo menos uma parcela");
      return;
    }

    setSending(true);

    try {
      const selectedItems = installments.filter((inst) =>
        selectedInstallments.includes(inst.id)
      );

      // Build message with all boletos
      let message = `📋 *BOLETOS DE PARCELAMENTO*\n\n`;
      message += `🏢 *Empresa:* ${negotiation.employers?.name || "N/A"}\n`;
      message += `🔢 *Acordo:* ${negotiation.negotiation_code}\n`;
      message += `💰 *Valor Total:* ${formatCurrency(negotiation.total_negotiated_value)}\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

      selectedItems.forEach((inst) => {
        message += `📌 *Parcela ${inst.installment_number}/${negotiation.installments_count}*\n`;
        message += `📅 Vencimento: ${format(parseDateOnly(inst.due_date), "dd/MM/yyyy")}\n`;
        message += `💵 Valor: ${formatCurrency(inst.value)}\n`;
        message += `🔗 Link: ${inst.lytex_invoice_url}\n\n`;
      });

      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `_${clinicName}_\n`;
      message += `_Enviado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}_`;

      // Send via WhatsApp
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          phone: cleanPhone,
          message,
          clinicId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao enviar");

      toast.success(`${selectedItems.length} boleto(s) enviado(s) via WhatsApp!`);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Enviar Boletos via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Selecione as parcelas para enviar os boletos via WhatsApp.
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

          {availableInstallments.length === 0 ? (
            <div className="p-4 bg-muted rounded-md text-center text-muted-foreground">
              Nenhuma parcela com boleto disponível para envio.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label>Parcelas para enviar</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedInstallments.length === availableInstallments.length
                    ? "Desmarcar Todos"
                    : "Selecionar Todos"}
                </Button>
              </div>

              <ScrollArea className="h-[200px] border rounded-md p-2">
                <div className="space-y-2">
                  {availableInstallments.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                      onClick={() => toggleInstallment(inst.id)}
                    >
                      <Checkbox
                        checked={selectedInstallments.includes(inst.id)}
                        onCheckedChange={() => toggleInstallment(inst.id)}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div>
                          <span className="font-medium">
                            Parcela {inst.installment_number}/{negotiation.installments_count}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {format(parseDateOnly(inst.due_date), "dd/MM/yyyy")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              inst.status === "overdue"
                                ? "bg-rose-500/15 text-rose-700"
                                : "bg-amber-500/15 text-amber-700"
                            }
                          >
                            {inst.status === "overdue" ? "Vencido" : "Pendente"}
                          </Badge>
                          <span className="font-medium">{formatCurrency(inst.value)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{selectedInstallments.length} parcela(s) selecionada(s)</span>
                <span>
                  Total:{" "}
                  {formatCurrency(
                    installments
                      .filter((inst) => selectedInstallments.includes(inst.id))
                      .reduce((sum, inst) => sum + inst.value, 0)
                  )}
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedInstallments.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Boletos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
