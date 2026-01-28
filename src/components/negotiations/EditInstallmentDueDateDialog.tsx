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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

interface NegotiationInstallment {
  id: string;
  negotiation_id: string;
  installment_number: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  paid_at: string | null;
  paid_value: number | null;
  negotiation?: {
    negotiation_code: string;
    employer_id: string;
    employers?: {
      id: string;
      name: string;
      cnpj: string;
      registration_number?: string | null;
    };
  };
}

interface EditInstallmentDueDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: NegotiationInstallment | null;
  onSuccess: () => void;
}

export default function EditInstallmentDueDateDialog({
  open,
  onOpenChange,
  installment,
  onSuccess,
}: EditInstallmentDueDateDialogProps) {
  const [newDueDate, setNewDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [lytexWarning, setLytexWarning] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<"success" | "local_only" | null>(null);

  useEffect(() => {
    if (open && installment) {
      // Parse the existing due date and format for input
      const currentDate = parseDateOnlyToLocalNoon(installment.due_date);
      setNewDueDate(format(currentDate, "yyyy-MM-dd"));
      setLytexWarning(null);
      setUpdateResult(null);
    }
  }, [open, installment]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSubmit = async () => {
    if (!installment || !newDueDate) return;

    setLoading(true);
    setLytexWarning(null);
    setUpdateResult(null);

    try {
      let lytexUpdated = false;
      let lytexError: string | null = null;

      // If the installment has a Lytex invoice, try to update it there first
      if (installment.lytex_invoice_id) {
        try {
          const valueInCents = Math.round(Number(installment.value) * 100);
          
          const { data, error } = await supabase.functions.invoke("lytex-api", {
            body: {
              action: "updateInvoice",
              invoiceId: installment.lytex_invoice_id,
              dueDate: newDueDate,
              value: valueInCents,
            },
          });

          if (error) {
            lytexError = error.message || "Erro ao atualizar no Lytex";
            console.error("[EditDueDate] Lytex error:", error);
          } else if (data?.error || !data?.success) {
            lytexError = data?.error || data?.message || "Lytex recusou a alteração";
            console.error("[EditDueDate] Lytex refused:", data);
          } else {
            lytexUpdated = true;
            console.log("[EditDueDate] Lytex updated successfully");
          }
        } catch (err: any) {
          lytexError = err.message || "Erro de comunicação com Lytex";
          console.error("[EditDueDate] Lytex exception:", err);
        }
      }

      // Always update locally, regardless of Lytex result
      // Normalize date to midday to prevent timezone issues
      const normalizedDate = `${newDueDate}T12:00:00`;
      
      const { error: dbError } = await supabase
        .from("negotiation_installments")
        .update({
          due_date: normalizedDate,
        })
        .eq("id", installment.id);

      if (dbError) {
        throw new Error("Erro ao atualizar data no banco de dados");
      }

      // Determine result type
      if (installment.lytex_invoice_id) {
        if (lytexUpdated) {
          setUpdateResult("success");
          toast.success("Data de vencimento atualizada com sucesso!");
        } else {
          setUpdateResult("local_only");
          setLytexWarning(lytexError || "A Lytex não permitiu a alteração, mas a data foi atualizada localmente.");
          toast.warning("Data atualizada localmente. O boleto no Lytex não foi alterado.");
        }
      } else {
        setUpdateResult("success");
        toast.success("Data de vencimento atualizada!");
      }

      // Delay closing to show result
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1500);

    } catch (error: any) {
      console.error("Error updating due date:", error);
      toast.error(error.message || "Erro ao atualizar data de vencimento");
    } finally {
      setLoading(false);
    }
  };

  if (!installment) return null;

  const isDownPayment = installment.installment_number === 0;
  const currentDueDate = parseDateOnlyToLocalNoon(installment.due_date);
  const hasBoleto = !!installment.lytex_invoice_id;
  const isPaid = installment.status === "paid";
  const isCancelled = installment.status === "cancelled";
  const isDisabled = isPaid || isCancelled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Editar Data de Vencimento
          </DialogTitle>
          <DialogDescription>
            {installment.negotiation?.negotiation_code} - {isDownPayment ? "Entrada" : `Parcela ${installment.installment_number}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Installment Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Empresa:</span>
              <span className="font-medium truncate max-w-[200px]">
                {installment.negotiation?.employers?.name || "-"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-medium">{formatCurrency(Number(installment.value))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vencimento atual:</span>
              <span className="font-medium">
                {format(currentDueDate, "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Boleto Lytex:</span>
              {hasBoleto ? (
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Gerado
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">Não gerado</span>
              )}
            </div>
          </div>

          {/* Disabled states */}
          {isPaid && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta parcela já foi paga e não pode ter a data alterada.
              </AlertDescription>
            </Alert>
          )}

          {isCancelled && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta parcela foi cancelada e não pode ser editada.
              </AlertDescription>
            </Alert>
          )}

          {/* New Date Input */}
          {!isDisabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newDueDate">Nova Data de Vencimento</Label>
                <Input
                  id="newDueDate"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>

              {hasBoleto && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Esta parcela já possui boleto gerado. A alteração será tentada na Lytex, mas se recusada 
                    (ex: falta menos de 30 minutos para vencimento), a data será atualizada apenas localmente.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Result Messages */}
          {updateResult === "success" && (
            <Alert className="border-emerald-500 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">
                Data atualizada com sucesso!
              </AlertDescription>
            </Alert>
          )}

          {updateResult === "local_only" && lytexWarning && (
            <Alert className="border-amber-500 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 text-xs">
                {lytexWarning}
                <br />
                <strong>A data foi atualizada localmente no sistema.</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {updateResult ? "Fechar" : "Cancelar"}
          </Button>
          {!isDisabled && !updateResult && (
            <Button onClick={handleSubmit} disabled={loading || !newDueDate}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
