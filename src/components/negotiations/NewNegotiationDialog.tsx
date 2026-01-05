import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import NegotiationStepEmployer from "./wizard/NegotiationStepEmployer";
import NegotiationStepContributions from "./wizard/NegotiationStepContributions";
import NegotiationStepCalculation from "./wizard/NegotiationStepCalculation";
import NegotiationStepInstallments from "./wizard/NegotiationStepInstallments";
import NegotiationStepPreview from "./wizard/NegotiationStepPreview";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
}

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  contribution_types?: {
    id: string;
    name: string;
  };
}

interface NegotiationSettings {
  interest_rate_monthly: number;
  monetary_correction_monthly: number;
  late_fee_percentage: number;
  max_installments: number;
  min_installment_value: number;
  allow_partial_negotiation: boolean;
  require_down_payment: boolean;
  min_down_payment_percentage: number;
  legal_basis: string;
}

interface CalculatedItem {
  contribution: Contribution;
  daysOverdue: number;
  interestValue: number;
  correctionValue: number;
  lateFeeValue: number;
  totalValue: number;
}

interface NewNegotiationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employers: Employer[];
  clinicId: string;
  userId: string;
  onSuccess: () => void;
}

const STEPS = ["employer", "contributions", "calculation", "installments", "preview"] as const;
type Step = (typeof STEPS)[number];

export default function NewNegotiationDialog({
  open,
  onOpenChange,
  employers,
  clinicId,
  userId,
  onSuccess,
}: NewNegotiationDialogProps) {
  const [currentStep, setCurrentStep] = useState<Step>("employer");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 1: Employer
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);

  // Step 2: Contributions
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [selectedContributions, setSelectedContributions] = useState<string[]>([]);

  // Step 3: Calculation
  const [settings, setSettings] = useState<NegotiationSettings | null>(null);
  const [calculatedItems, setCalculatedItems] = useState<CalculatedItem[]>([]);

  // Step 4: Installments
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [downPayment, setDownPayment] = useState(0);
  const [firstDueDate, setFirstDueDate] = useState<Date>(new Date());

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep("employer");
      setSelectedEmployer(null);
      setContributions([]);
      setSelectedContributions([]);
      setSettings(null);
      setCalculatedItems([]);
      setInstallmentsCount(1);
      setDownPayment(0);
      setFirstDueDate(new Date());
    }
  }, [open]);

  // Fetch settings when dialog opens
  useEffect(() => {
    if (open && clinicId) {
      fetchSettings();
    }
  }, [open, clinicId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("negotiation_settings")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          interest_rate_monthly: Number(data.interest_rate_monthly),
          monetary_correction_monthly: Number(data.monetary_correction_monthly),
          late_fee_percentage: Number(data.late_fee_percentage),
          max_installments: data.max_installments,
          min_installment_value: Number(data.min_installment_value),
          allow_partial_negotiation: data.allow_partial_negotiation,
          require_down_payment: data.require_down_payment,
          min_down_payment_percentage: Number(data.min_down_payment_percentage || 10),
          legal_basis: data.legal_basis || "",
        });
      } else {
        // Default settings
        setSettings({
          interest_rate_monthly: 1.0,
          monetary_correction_monthly: 0.5,
          late_fee_percentage: 2.0,
          max_installments: 12,
          min_installment_value: 100,
          allow_partial_negotiation: true,
          require_down_payment: false,
          min_down_payment_percentage: 10,
          legal_basis: "",
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  // Fetch contributions when employer is selected
  const fetchContributions = async (employerId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          contribution_types (id, name)
        `)
        .eq("employer_id", employerId)
        .in("status", ["pending", "overdue"])
        .is("negotiation_id", null)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setContributions(data || []);
    } catch (error) {
      console.error("Error fetching contributions:", error);
      toast.error("Erro ao carregar contribuições");
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const originalValue = calculatedItems.reduce((sum, item) => sum + item.contribution.value, 0);
    const totalInterest = calculatedItems.reduce((sum, item) => sum + item.interestValue, 0);
    const totalCorrection = calculatedItems.reduce((sum, item) => sum + item.correctionValue, 0);
    const totalLateFee = calculatedItems.reduce((sum, item) => sum + item.lateFeeValue, 0);
    const totalNegotiated = calculatedItems.reduce((sum, item) => sum + item.totalValue, 0);
    const amountToFinance = totalNegotiated - downPayment;
    const installmentValue = installmentsCount > 0 ? amountToFinance / installmentsCount : 0;

    return {
      originalValue,
      totalInterest,
      totalCorrection,
      totalLateFee,
      totalNegotiated,
      amountToFinance,
      installmentValue,
    };
  }, [calculatedItems, downPayment, installmentsCount]);

  // Handle step navigation
  const handleNext = async () => {
    const currentIndex = STEPS.indexOf(currentStep);
    
    if (currentStep === "employer" && selectedEmployer) {
      await fetchContributions(selectedEmployer.id);
    }
    
    if (currentStep === "contributions" && selectedContributions.length > 0 && settings) {
      // Calculate values for selected contributions
      const selected = contributions.filter((c) => selectedContributions.includes(c.id));
      const today = new Date();
      
      const calculated = selected.map((contribution) => {
        const dueDate = new Date(contribution.due_date);
        const diffTime = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        const monthsOverdue = daysOverdue / 30;
        
        const interestValue = contribution.value * (settings.interest_rate_monthly / 100) * monthsOverdue;
        const correctionValue = contribution.value * (settings.monetary_correction_monthly / 100) * monthsOverdue;
        const lateFeeValue = daysOverdue > 0 ? contribution.value * (settings.late_fee_percentage / 100) : 0;
        const totalValue = contribution.value + interestValue + correctionValue + lateFeeValue;

        return {
          contribution,
          daysOverdue,
          interestValue,
          correctionValue,
          lateFeeValue,
          totalValue,
        };
      });

      setCalculatedItems(calculated);
    }

    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const handleSave = async () => {
    if (!selectedEmployer || !settings) return;
    
    setSaving(true);
    try {
      // Generate negotiation code
      const { data: codeData, error: codeError } = await supabase
        .rpc("generate_negotiation_code", { p_clinic_id: clinicId });

      if (codeError) throw codeError;

      // Create negotiation
      const { data: negotiation, error: negError } = await supabase
        .from("debt_negotiations")
        .insert({
          clinic_id: clinicId,
          employer_id: selectedEmployer.id,
          negotiation_code: codeData,
          status: "simulation",
          total_original_value: totals.originalValue,
          total_interest: totals.totalInterest,
          total_monetary_correction: totals.totalCorrection,
          total_late_fee: totals.totalLateFee,
          total_negotiated_value: totals.totalNegotiated,
          down_payment_value: downPayment,
          installments_count: installmentsCount,
          installment_value: totals.installmentValue,
          first_due_date: firstDueDate.toISOString().split("T")[0],
          applied_interest_rate: settings.interest_rate_monthly,
          applied_correction_rate: settings.monetary_correction_monthly,
          applied_late_fee_rate: settings.late_fee_percentage,
          created_by: userId,
        })
        .select()
        .single();

      if (negError) throw negError;

      // Create negotiation items
      const items = calculatedItems.map((item) => ({
        negotiation_id: negotiation.id,
        contribution_id: item.contribution.id,
        original_value: item.contribution.value,
        due_date: item.contribution.due_date,
        competence_month: item.contribution.competence_month,
        competence_year: item.contribution.competence_year,
        contribution_type_name: item.contribution.contribution_types?.name || "",
        days_overdue: item.daysOverdue,
        interest_value: item.interestValue,
        correction_value: item.correctionValue,
        late_fee_value: item.lateFeeValue,
        total_value: item.totalValue,
      }));

      const { error: itemsError } = await supabase
        .from("negotiation_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Create installments
      const installments = [];
      let dueDate = new Date(firstDueDate);
      
      for (let i = 1; i <= installmentsCount; i++) {
        installments.push({
          negotiation_id: negotiation.id,
          installment_number: i,
          value: totals.installmentValue,
          due_date: dueDate.toISOString().split("T")[0],
          status: "pending",
        });
        dueDate.setMonth(dueDate.getMonth() + 1);
      }

      const { error: installmentsError } = await supabase
        .from("negotiation_installments")
        .insert(installments);

      if (installmentsError) throw installmentsError;

      toast.success("Negociação criada com sucesso!");
      onSuccess();
    } catch (error) {
      console.error("Error saving negotiation:", error);
      toast.error("Erro ao criar negociação");
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "employer":
        return !!selectedEmployer;
      case "contributions":
        return selectedContributions.length > 0;
      case "calculation":
        return calculatedItems.length > 0;
      case "installments":
        return (
          installmentsCount > 0 &&
          installmentsCount <= (settings?.max_installments || 12) &&
          totals.installmentValue >= (settings?.min_installment_value || 0) &&
          (!settings?.require_down_payment || downPayment >= totals.totalNegotiated * (settings.min_down_payment_percentage / 100))
        );
      case "preview":
        return true;
      default:
        return false;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "employer":
        return "Selecionar Empresa";
      case "contributions":
        return "Selecionar Contribuições";
      case "calculation":
        return "Cálculo de Encargos";
      case "installments":
        return "Parcelamento";
      case "preview":
        return "Espelho da Negociação";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>
            Passo {STEPS.indexOf(currentStep) + 1} de {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {currentStep === "employer" && (
            <NegotiationStepEmployer
              employers={employers}
              selectedEmployer={selectedEmployer}
              onSelectEmployer={setSelectedEmployer}
            />
          )}

          {currentStep === "contributions" && (
            <NegotiationStepContributions
              contributions={contributions}
              selectedContributions={selectedContributions}
              onSelectContributions={setSelectedContributions}
              loading={loading}
              allowPartial={settings?.allow_partial_negotiation ?? true}
            />
          )}

          {currentStep === "calculation" && settings && (
            <NegotiationStepCalculation
              calculatedItems={calculatedItems}
              settings={settings}
              totals={totals}
            />
          )}

          {currentStep === "installments" && settings && (
            <NegotiationStepInstallments
              totalValue={totals.totalNegotiated}
              settings={settings}
              installmentsCount={installmentsCount}
              onInstallmentsCountChange={setInstallmentsCount}
              downPayment={downPayment}
              onDownPaymentChange={setDownPayment}
              firstDueDate={firstDueDate}
              onFirstDueDateChange={setFirstDueDate}
              installmentValue={totals.installmentValue}
            />
          )}

          {currentStep === "preview" && settings && selectedEmployer && (
            <NegotiationStepPreview
              employer={selectedEmployer}
              calculatedItems={calculatedItems}
              settings={settings}
              totals={totals}
              installmentsCount={installmentsCount}
              downPayment={downPayment}
              firstDueDate={firstDueDate}
              clinicId={clinicId}
            />
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === "employer" || saving}
          >
            Voltar
          </Button>

          {currentStep !== "preview" ? (
            <Button onClick={handleNext} disabled={!canProceed() || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Próximo
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Simulação
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
