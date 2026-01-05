import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, Percent, DollarSign, Calendar, FileText } from "lucide-react";

interface NegotiationSettings {
  id?: string;
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

interface NegotiationSettingsTabProps {
  clinicId: string;
}

export default function NegotiationSettingsTab({ clinicId }: NegotiationSettingsTabProps) {
  const [settings, setSettings] = useState<NegotiationSettings>({
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clinicId) {
      fetchSettings();
    }
  }, [clinicId]);

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
          id: data.id,
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
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        clinic_id: clinicId,
        interest_rate_monthly: settings.interest_rate_monthly,
        monetary_correction_monthly: settings.monetary_correction_monthly,
        late_fee_percentage: settings.late_fee_percentage,
        max_installments: settings.max_installments,
        min_installment_value: settings.min_installment_value,
        allow_partial_negotiation: settings.allow_partial_negotiation,
        require_down_payment: settings.require_down_payment,
        min_down_payment_percentage: settings.min_down_payment_percentage,
        legal_basis: settings.legal_basis,
      };

      if (settings.id) {
        const { error } = await supabase
          .from("negotiation_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("negotiation_settings").insert(payload);

        if (error) throw error;
      }

      toast.success("Configurações salvas com sucesso");
      fetchSettings();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Taxas e Encargos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Taxas e Encargos
          </CardTitle>
          <CardDescription>
            Configure os percentuais de juros, correção monetária e multa aplicáveis nas negociações
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="interest_rate">Juros Mensais (%)</Label>
            <Input
              id="interest_rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={settings.interest_rate_monthly}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  interest_rate_monthly: parseFloat(e.target.value) || 0,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Juros aplicados por mês de atraso
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="correction_rate">Correção Monetária Mensal (%)</Label>
            <Input
              id="correction_rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={settings.monetary_correction_monthly}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  monetary_correction_monthly: parseFloat(e.target.value) || 0,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Percentual fixo mensal de correção
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="late_fee">Multa Moratória (%)</Label>
            <Input
              id="late_fee"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={settings.late_fee_percentage}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  late_fee_percentage: parseFloat(e.target.value) || 0,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Multa única aplicada por atraso
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Parcelamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Parcelamento
          </CardTitle>
          <CardDescription>
            Defina os limites e regras para parcelamento das negociações
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="max_installments">Máximo de Parcelas</Label>
            <Input
              id="max_installments"
              type="number"
              min="1"
              max="120"
              value={settings.max_installments}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  max_installments: parseInt(e.target.value) || 1,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_installment">Valor Mínimo da Parcela (R$)</Label>
            <Input
              id="min_installment"
              type="number"
              step="0.01"
              min="0"
              value={settings.min_installment_value}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  min_installment_value: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Regras Adicionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Regras Adicionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Permitir Negociação Parcial</Label>
              <p className="text-sm text-muted-foreground">
                Permite selecionar apenas algumas contribuições em atraso
              </p>
            </div>
            <Switch
              checked={settings.allow_partial_negotiation}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, allow_partial_negotiation: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Exigir Entrada</Label>
              <p className="text-sm text-muted-foreground">
                Torna obrigatório o pagamento de uma entrada
              </p>
            </div>
            <Switch
              checked={settings.require_down_payment}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, require_down_payment: checked }))
              }
            />
          </div>

          {settings.require_down_payment && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Label htmlFor="min_down_payment">Entrada Mínima (%)</Label>
              <Input
                id="min_down_payment"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={settings.min_down_payment_percentage}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    min_down_payment_percentage: parseFloat(e.target.value) || 0,
                  }))
                }
                className="max-w-[200px]"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fundamentação Legal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Fundamentação Legal
          </CardTitle>
          <CardDescription>
            Texto normativo ou regra utilizada como base para os cálculos (exibido no espelho)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.legal_basis}
            onChange={(e) => setSettings((s) => ({ ...s, legal_basis: e.target.value }))}
            placeholder="Ex: Conforme disposto na Convenção Coletiva de Trabalho 2024/2025, cláusula 45..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
