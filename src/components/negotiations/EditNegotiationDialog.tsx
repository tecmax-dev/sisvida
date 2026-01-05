import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Loader2, Save, Calculator } from "lucide-react";
import { format, addMonths } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

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
  employers?: Employer;
}

interface EditNegotiationDialogProps {
  negotiation: Negotiation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EditNegotiationDialog({
  negotiation,
  open,
  onOpenChange,
  onSuccess,
}: EditNegotiationDialogProps) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  // Editable fields
  const [installmentsCount, setInstallmentsCount] = useState(negotiation.installments_count);
  const [downPaymentValue, setDownPaymentValue] = useState(negotiation.down_payment_value || 0);
  const [downPaymentDueDate, setDownPaymentDueDate] = useState(
    negotiation.down_payment_due_date 
      ? negotiation.down_payment_due_date.split('T')[0]
      : format(new Date(), "yyyy-MM-dd")
  );
  const [firstDueDate, setFirstDueDate] = useState(
    negotiation.first_due_date.split('T')[0]
  );
  const [appliedInterestRate, setAppliedInterestRate] = useState(negotiation.applied_interest_rate);
  const [appliedCorrectionRate, setAppliedCorrectionRate] = useState(negotiation.applied_correction_rate);
  const [appliedLateFeeRate, setAppliedLateFeeRate] = useState(negotiation.applied_late_fee_rate);

  // Calculated values
  const [calculatedInstallmentValue, setCalculatedInstallmentValue] = useState(negotiation.installment_value);

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setInstallmentsCount(negotiation.installments_count);
      setDownPaymentValue(negotiation.down_payment_value || 0);
      setDownPaymentDueDate(
        negotiation.down_payment_due_date 
          ? negotiation.down_payment_due_date.split('T')[0]
          : format(new Date(), "yyyy-MM-dd")
      );
      setFirstDueDate(negotiation.first_due_date.split('T')[0]);
      setAppliedInterestRate(negotiation.applied_interest_rate);
      setAppliedCorrectionRate(negotiation.applied_correction_rate);
      setAppliedLateFeeRate(negotiation.applied_late_fee_rate);
      recalculate();
    }
  }, [open, negotiation]);

  useEffect(() => {
    recalculate();
  }, [installmentsCount, downPaymentValue]);

  const recalculate = () => {
    const totalValue = negotiation.total_negotiated_value;
    const remainingValue = totalValue - (downPaymentValue || 0);
    const installmentVal = installmentsCount > 0 ? remainingValue / installmentsCount : 0;
    setCalculatedInstallmentValue(Math.max(0, installmentVal));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSave = async () => {
    if (installmentsCount < 1 || installmentsCount > 60) {
      toast.error("Número de parcelas deve ser entre 1 e 60");
      return;
    }

    if (downPaymentValue < 0) {
      toast.error("Valor de entrada não pode ser negativo");
      return;
    }

    if (downPaymentValue >= negotiation.total_negotiated_value) {
      toast.error("Valor de entrada deve ser menor que o total negociado");
      return;
    }

    setProcessing(true);
    try {
      // Update negotiation
      const { error: negError } = await supabase
        .from("debt_negotiations")
        .update({
          installments_count: installmentsCount,
          down_payment_value: downPaymentValue,
          down_payment_due_date: downPaymentValue > 0 ? downPaymentDueDate : null,
          installment_value: calculatedInstallmentValue,
          first_due_date: firstDueDate,
          applied_interest_rate: appliedInterestRate,
          applied_correction_rate: appliedCorrectionRate,
          applied_late_fee_rate: appliedLateFeeRate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", negotiation.id);

      if (negError) throw negError;

      // Delete existing installments
      const { error: deleteError } = await supabase
        .from("negotiation_installments")
        .delete()
        .eq("negotiation_id", negotiation.id);

      if (deleteError) throw deleteError;

      // Create new installments
      const newInstallments = [];
      for (let i = 1; i <= installmentsCount; i++) {
        const dueDate = addMonths(new Date(firstDueDate), i - 1);
        newInstallments.push({
          negotiation_id: negotiation.id,
          installment_number: i,
          value: calculatedInstallmentValue,
          due_date: format(dueDate, "yyyy-MM-dd"),
          status: "pending",
        });
      }

      const { error: installmentsError } = await supabase
        .from("negotiation_installments")
        .insert(newInstallments);

      if (installmentsError) throw installmentsError;

      toast.success("Negociação atualizada com sucesso");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao salvar alterações");
    } finally {
      setProcessing(false);
    }
  };

  // Only allow editing if status is simulation or pending_approval
  const canEdit = ["simulation", "pending_approval"].includes(negotiation.status);

  if (!canEdit) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Negociação</DialogTitle>
          <DialogDescription>
            {negotiation.negotiation_code} - {negotiation.employers?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Installments Count */}
          <div className="space-y-2">
            <Label htmlFor="installments">Número de Parcelas</Label>
            <Input
              id="installments"
              type="number"
              min={1}
              max={60}
              value={installmentsCount}
              onChange={(e) => setInstallmentsCount(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Down Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="downPayment">Valor de Entrada (R$)</Label>
              <Input
                id="downPayment"
                type="number"
                min={0}
                step={0.01}
                value={downPaymentValue}
                onChange={(e) => setDownPaymentValue(parseFloat(e.target.value) || 0)}
              />
            </div>
            {downPaymentValue > 0 && (
              <div className="space-y-2">
                <Label htmlFor="downPaymentDueDate">Vencimento da Entrada</Label>
                <Input
                  id="downPaymentDueDate"
                  type="date"
                  value={downPaymentDueDate}
                  onChange={(e) => setDownPaymentDueDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* First Due Date */}
          <div className="space-y-2">
            <Label htmlFor="firstDueDate">Data da Primeira Parcela</Label>
            <Input
              id="firstDueDate"
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
            />
          </div>

          {/* Rates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="interestRate">Juros (%)</Label>
              <Input
                id="interestRate"
                type="number"
                min={0}
                step={0.01}
                value={appliedInterestRate}
                onChange={(e) => setAppliedInterestRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correctionRate">Correção (%)</Label>
              <Input
                id="correctionRate"
                type="number"
                min={0}
                step={0.01}
                value={appliedCorrectionRate}
                onChange={(e) => setAppliedCorrectionRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lateFeeRate">Multa (%)</Label>
              <Input
                id="lateFeeRate"
                type="number"
                min={0}
                step={0.01}
                value={appliedLateFeeRate}
                onChange={(e) => setAppliedLateFeeRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Calculated Summary */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4" />
              Resumo Calculado
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Negociado:</span>
                <span className="font-medium">{formatCurrency(negotiation.total_negotiated_value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrada:</span>
                <span>{formatCurrency(downPaymentValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Parcelado:</span>
                <span>{formatCurrency(negotiation.total_negotiated_value - downPaymentValue)}</span>
              </div>
              <div className="flex justify-between font-medium text-primary">
                <span>Valor de Cada Parcela:</span>
                <span>{installmentsCount}x de {formatCurrency(calculatedInstallmentValue)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={processing}>
            {processing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
