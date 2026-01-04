import { useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contribution {
  id: string;
  value: number;
  due_date: string;
  status: string;
  competence_month: number;
  competence_year: number;
  lytex_invoice_url: string | null;
  employers?: {
    name: string;
    cnpj: string;
    phone?: string | null;
  };
  contribution_types?: {
    name: string;
  };
}

interface SendBoletoWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributions: Contribution[];
  clinicId: string;
}

export function SendBoletoWhatsAppDialog({
  open,
  onOpenChange,
  contributions,
  clinicId,
}: SendBoletoWhatsAppDialogProps) {
  const [phone, setPhone] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Filter contributions that have boleto URL and are not paid/cancelled
  const eligibleContributions = contributions.filter(
    (c) => c.lytex_invoice_url && c.status !== "paid" && c.status !== "cancelled"
  );

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === eligibleContributions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleContributions.map((c) => c.id)));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
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

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Digite um número de telefone válido");
      return;
    }

    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um boleto para enviar");
      return;
    }

    setSending(true);

    try {
      const selected = eligibleContributions.filter((c) => selectedIds.has(c.id));
      
      // Build message with all selected boletos
      let message = `📋 *Boletos em Aberto*\n\n`;
      
      for (const contrib of selected) {
        const monthName = format(new Date(contrib.competence_year, contrib.competence_month - 1), "MMMM/yyyy", { locale: ptBR });
        const dueDate = format(new Date(contrib.due_date), "dd/MM/yyyy");
        const statusLabel = contrib.status === "overdue" ? "⚠️ VENCIDO" : "🟢 A vencer";
        
        message += `━━━━━━━━━━━━━━━━\n`;
        message += `*Empresa:* ${contrib.employers?.name || "N/A"}\n`;
        message += `*Competência:* ${monthName}\n`;
        message += `*Vencimento:* ${dueDate}\n`;
        message += `*Valor:* ${formatCurrency(contrib.value)}\n`;
        message += `*Status:* ${statusLabel}\n`;
        message += `\n🔗 *Link do Boleto:*\n${contrib.lytex_invoice_url}\n\n`;
      }

      message += `━━━━━━━━━━━━━━━━\n`;
      message += `_Enviado via sistema de contribuições_`;

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          phone: cleanPhone,
          message,
          clinicId,
          type: "custom",
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao enviar");

      toast.success(`${selected.length} boleto(s) enviado(s) com sucesso!`);
      onOpenChange(false);
      setPhone("");
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Erro ao enviar boletos:", error);
      toast.error(error.message || "Erro ao enviar boletos via WhatsApp");
    } finally {
      setSending(false);
    }
  };

  // Pre-fill phone if only one employer selected
  const handleOpen = () => {
    if (eligibleContributions.length === 1 && eligibleContributions[0].employers?.phone) {
      setPhone(formatPhone(eligibleContributions[0].employers.phone));
      setSelectedIds(new Set([eligibleContributions[0].id]));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Enviar Boletos via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Selecione os boletos e informe o número para envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Boletos Disponíveis</Label>
              {eligibleContributions.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs h-7"
                >
                  {selectedIds.size === eligibleContributions.length
                    ? "Desmarcar todos"
                    : "Selecionar todos"}
                </Button>
              )}
            </div>

            {eligibleContributions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum boleto disponível para envio.
                <br />
                <span className="text-xs">
                  (Apenas boletos pendentes/vencidos com link gerado)
                </span>
              </p>
            ) : (
              <ScrollArea className="h-[240px] border rounded-md">
                <div className="p-2 space-y-2">
                  {eligibleContributions.map((contrib) => {
                    const monthName = format(
                      new Date(contrib.competence_year, contrib.competence_month - 1),
                      "MMM/yy",
                      { locale: ptBR }
                    );
                    return (
                      <div
                        key={contrib.id}
                        className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                          selectedIds.has(contrib.id)
                            ? "bg-primary/5 border-primary"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => handleToggle(contrib.id)}
                      >
                        <Checkbox
                          checked={selectedIds.has(contrib.id)}
                          onCheckedChange={() => handleToggle(contrib.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-medium leading-tight">
                            {contrib.employers?.name || "Empresa"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {monthName} • Venc: {format(new Date(contrib.due_date), "dd/MM/yy")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-semibold whitespace-nowrap">
                            {formatCurrency(contrib.value)}
                          </span>
                          <Badge
                            variant={contrib.status === "overdue" ? "destructive" : "outline"}
                            className="text-[10px] px-1.5"
                          >
                            {contrib.status === "overdue" ? "Vencido" : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {selectedIds.size > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} boleto(s) selecionado(s)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedIds.size === 0 || phone.replace(/\D/g, "").length < 10}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
