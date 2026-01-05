import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Loader2, 
  Save, 
  Percent, 
  DollarSign, 
  Calendar, 
  FileText, 
  Settings2,
  TrendingUp,
  Banknote,
  Scale,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

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
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Settings2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">Configurações de Negociação</p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Defina as regras e parâmetros que serão aplicados automaticamente em todas as negociações de débitos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Taxas e Encargos */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/25">
              <Percent className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Taxas e Encargos</CardTitle>
              <CardDescription>
                Configure os percentuais de juros, correção monetária e multa
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
                <Label htmlFor="interest_rate" className="font-medium">Juros Mensais</Label>
              </div>
              <div className="relative">
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
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Juros aplicados por mês de atraso
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10">
                  <Banknote className="h-4 w-4 text-purple-600" />
                </div>
                <Label htmlFor="correction_rate" className="font-medium">Correção Monetária</Label>
              </div>
              <div className="relative">
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
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentual fixo mensal de correção
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <Label htmlFor="late_fee" className="font-medium">Multa Moratória</Label>
              </div>
              <div className="relative">
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
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Multa única aplicada por atraso
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parcelamento */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Parcelamento</CardTitle>
              <CardDescription>
                Defina os limites e regras para parcelamento das negociações
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                </div>
                <Label htmlFor="max_installments" className="font-medium">Máximo de Parcelas</Label>
              </div>
              <div className="relative">
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
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">x</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <Label htmlFor="min_installment" className="font-medium">Valor Mínimo da Parcela</Label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
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
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regras Adicionais */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/25">
              <Scale className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Regras Adicionais</CardTitle>
              <CardDescription>
                Configurações extras para o processo de negociação
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <Label className="font-medium">Permitir Negociação Parcial</Label>
                <p className="text-sm text-muted-foreground">
                  Permite selecionar apenas algumas contribuições em atraso
                </p>
              </div>
            </div>
            <Switch
              checked={settings.allow_partial_negotiation}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, allow_partial_negotiation: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <Label className="font-medium">Exigir Entrada</Label>
                <p className="text-sm text-muted-foreground">
                  Torna obrigatório o pagamento de uma entrada
                </p>
              </div>
            </div>
            <Switch
              checked={settings.require_down_payment}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, require_down_payment: checked }))
              }
            />
          </div>

          {settings.require_down_payment && (
            <div className="ml-6 pl-6 border-l-2 border-primary/20 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                <Label htmlFor="min_down_payment" className="font-medium">Entrada Mínima</Label>
              </div>
              <div className="relative max-w-[200px]">
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
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fundamentação Legal */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg shadow-slate-500/25">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Fundamentação Legal</CardTitle>
              <CardDescription>
                Texto normativo ou regra utilizada como base para os cálculos (exibido no espelho)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={settings.legal_basis}
            onChange={(e) => setSettings((s) => ({ ...s, legal_basis: e.target.value }))}
            placeholder="Ex: Conforme disposto na Convenção Coletiva de Trabalho 2024/2025, cláusula 45..."
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={fetchSettings} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
