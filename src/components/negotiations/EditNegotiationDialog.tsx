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
import { Loader2, Save, Calculator, Link2, Copy, Check, Clock } from "lucide-react";
import { format, addMonths, addDays } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
  registration_number?: string | null;
}

interface Negotiation {
  id: string;
  negotiation_code: string;
  status: string;
  clinic_id?: string;
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
  const { user, currentClinic } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkValidityDays, setLinkValidityDays] = useState(30);

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

  const generateAccessToken = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const getPublicBaseUrl = () => {
    // When testing inside preview, we still want to generate the real public domain.
    const origin = window.location.origin;
    return origin.includes("lovable.app") ? "https://app.eclini.com.br" : origin;
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const clinicId = negotiation.clinic_id || currentClinic?.id;
      if (!clinicId) {
        toast.error("Não foi possível identificar a clínica para gerar o link");
        return;
      }

      const accessToken = generateAccessToken();

      // Fetch negotiation items snapshot
      const { data: items, error: itemsError } = await supabase
        .from("negotiation_items")
        .select(
          "contribution_id, contribution_type_name, competence_month, competence_year, due_date, original_value, days_overdue, interest_value, correction_value, late_fee_value, total_value"
        )
        .eq("negotiation_id", negotiation.id)
        .order("due_date", { ascending: true });

      if (itemsError) throw itemsError;

      // Optional: legal basis from settings
      const { data: settingsData } = await supabase
        .from("negotiation_settings")
        .select("legal_basis")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      const contributionsSnapshot = (items || []).map((item) => ({
        contribution_id: item.contribution_id,
        contribution_type_name: item.contribution_type_name,
        competence_month: item.competence_month,
        competence_year: item.competence_year,
        due_date: item.due_date,
        original_value: Number(item.original_value),
        days_overdue: item.days_overdue,
        interest_value: Number(item.interest_value),
        correction_value: Number(item.correction_value),
        late_fee_value: Number(item.late_fee_value),
        total_value: Number(item.total_value),
      }));

      const { error } = await supabase.from("negotiation_previews").insert({
        clinic_id: clinicId,
        employer_id: negotiation.employer_id,
        negotiation_id: negotiation.id,
        access_token: accessToken,
        employer_name: negotiation.employers?.name || "",
        employer_cnpj: negotiation.employers?.cnpj || "",
        employer_trade_name: negotiation.employers?.trade_name || null,
        interest_rate_monthly: negotiation.applied_interest_rate,
        monetary_correction_monthly: negotiation.applied_correction_rate,
        late_fee_percentage: negotiation.applied_late_fee_rate,
        legal_basis: settingsData?.legal_basis || null,
        total_original_value: negotiation.total_original_value,
        total_interest: negotiation.total_interest,
        total_correction: negotiation.total_monetary_correction,
        total_late_fee: negotiation.total_late_fee,
        total_negotiated_value: negotiation.total_negotiated_value,
        installments_count: installmentsCount,
        installment_value: calculatedInstallmentValue,
        down_payment: downPaymentValue,
        first_due_date: firstDueDate,
        contributions_data: contributionsSnapshot,
        custom_dates: null,
        expires_at: addDays(new Date(), linkValidityDays).toISOString(),
      });

      if (error) {
        console.error("Error creating preview:", error);
        toast.error("Erro ao gerar link");
        return;
      }

      const link = `${getPublicBaseUrl()}/negociacao-espelho/${accessToken}`;
      setGeneratedLink(link);
      toast.success("Link gerado com sucesso!");
    } catch (err) {
      console.error("Error generating link:", err);
      toast.error("Erro ao gerar link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
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

          {/* Link Generation Section */}
          <div className="rounded-lg bg-muted/50 p-4 border space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Compartilhar via Link</span>
            </div>
            
            {/* Validity Days Config */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Validade do link:
              </label>
              <select
                value={linkValidityDays}
                onChange={(e) => setLinkValidityDays(Number(e.target.value))}
                className="px-2 py-1 text-sm border rounded-md bg-background"
                disabled={!!generatedLink}
              >
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
                <option value={180}>180 dias</option>
                <option value={365}>1 ano</option>
              </select>
            </div>

            {generatedLink && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Link válido por {linkValidityDays} dias (até {format(addDays(new Date(), linkValidityDays), "dd/MM/yyyy")}):
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateLink}
            disabled={processing || generatingLink}
          >
            {generatingLink ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            Gerar Link
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
