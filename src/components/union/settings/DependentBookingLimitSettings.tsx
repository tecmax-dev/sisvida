import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BOOKING_PERIOD_OPTIONS, bookingPeriodShort, normalizeBookingPeriod } from "./bookingPeriodOptions";

interface DependentBookingLimitSettingsProps {
  clinicId: string;
  currentPeriod: string;
  currentLimit: number;
  currentEnabled: boolean;
  onUpdate: () => void;
  isAdmin: boolean;
}

const PERIOD_OPTIONS = BOOKING_PERIOD_OPTIONS;

export function DependentBookingLimitSettings({
  clinicId,
  currentPeriod,
  currentLimit,
  currentEnabled,
  onUpdate,
  isAdmin,
}: DependentBookingLimitSettingsProps) {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [period, setPeriod] = useState(normalizeBookingPeriod(currentPeriod));
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
          dependent_booking_limit_enabled: enabled,
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

  const periodLabel = bookingPeriodShort(period);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Limite de Agendamento por Dependente
        </CardTitle>
        <CardDescription>
          Quantas consultas cada dependente pode marcar com o mesmo profissional em cada período
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="dep-enabled" className="text-sm font-medium">Ativar regra de limite</Label>
            <p className="text-xs text-muted-foreground">
              Quando ativada, a regra se aplica a agendamentos pelo painel e pelo app (PWA)
            </p>
          </div>
          <Switch
            id="dep-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!isAdmin}
          />
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
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
          <strong>Regra atual:</strong> cada dependente pode ter no máximo{" "}
          <strong>{limit === 0 ? "ilimitadas" : limit}</strong> consulta(s) com o mesmo profissional{" "}
          {period === "monthly" ? <>por <strong>mês</strong></> : <>dentro de qualquer intervalo de <strong>{periodLabel}</strong></>}.
          Continua valendo: 1 dependente do mesmo titular por semana com o mesmo profissional.
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
