import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DependentBookingLimitSettingsProps {
  clinicId: string;
  currentPeriod: string;
  currentLimit: number;
  currentEnabled: boolean;
  onUpdate: () => void;
  isAdmin: boolean;
}

const PERIOD_OPTIONS = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
];

export function DependentBookingLimitSettings({
  clinicId,
  currentPeriod,
  currentLimit,
  currentEnabled,
  onUpdate,
  isAdmin,
}: DependentBookingLimitSettingsProps) {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [period, setPeriod] = useState(currentPeriod || "monthly");
  const [limit, setLimit] = useState(currentLimit ?? 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem alterar esta configuração.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({
          dependent_booking_period: period,
          dependent_booking_limit: limit,
        } as any)
        .eq("id", clinicId);

      if (error) throw error;
      toast.success("Configuração de agendamento de dependentes atualizada!");
      onUpdate();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label?.toLowerCase() || "mês";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Limite de Agendamento por Dependente
        </CardTitle>
        <CardDescription>
          Configure a quantidade máxima de agendamentos que os dependentes de um titular podem fazer por profissional em um determinado período
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dep-period">Período de controle</Label>
            <Select value={period} onValueChange={setPeriod} disabled={!isAdmin}>
              <SelectTrigger id="dep-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dep-limit">Quantidade máxima</Label>
            <Input
              id="dep-limit"
              type="number"
              min={0}
              max={99}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={!isAdmin}
            />
            <p className="text-xs text-muted-foreground">
              0 = sem limite
            </p>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong>Regra atual:</strong> Cada titular poderá agendar no máximo{" "}
          <strong>{limit === 0 ? "ilimitados" : limit}</strong> dependente(s) por profissional por{" "}
          <strong>{periodLabel}</strong>.
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
