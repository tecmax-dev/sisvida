import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BOOKING_PERIOD_OPTIONS, bookingPeriodShort, normalizeBookingPeriod } from "./bookingPeriodOptions";

interface TitularBookingLimitSettingsProps {
  clinicId: string;
  currentEnabled: boolean;
  currentPeriod?: string | null;
  currentLimit?: number | null;
  onUpdate: () => void;
  isAdmin: boolean;
}

export function TitularBookingLimitSettings({
  clinicId,
  currentEnabled,
  currentPeriod,
  currentLimit,
  onUpdate,
  isAdmin,
}: TitularBookingLimitSettingsProps) {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [period, setPeriod] = useState(normalizeBookingPeriod(currentPeriod));
  const [limit, setLimit] = useState<number>(currentLimit ?? 1);
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
          titular_booking_limit_enabled: enabled,
          titular_booking_period: period,
          max_appointments_per_cpf_month: Math.max(0, Math.min(99, limit || 0)),
        } as any)
        .eq("id", clinicId);
      if (error) throw error;
      toast.success("Configuração de limite do titular atualizada!");
      onUpdate();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const periodText = bookingPeriodShort(period);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          Limite de Agendamento do Titular
        </CardTitle>
        <CardDescription>
          Quantas consultas o titular (sócio) pode marcar com o mesmo profissional em cada período
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="titular-enabled" className="text-sm font-medium">Ativar regra de limite</Label>
            <p className="text-xs text-muted-foreground">
              Vale para agendamentos pelo painel e pelo app (PWA). Administradores não são bloqueados.
            </p>
          </div>
          <Switch id="titular-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!isAdmin} />
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity ${!enabled ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="space-y-2">
            <Label htmlFor="tit-period">Período de controle</Label>
            <Select value={period} onValueChange={setPeriod} disabled={!isAdmin}>
              <SelectTrigger id="tit-period"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOOKING_PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tit-limit">Quantidade máxima</Label>
            <Input id="tit-limit" type="number" min={0} max={99} value={limit}
              onChange={(e) => setLimit(Number(e.target.value))} disabled={!isAdmin} />
            <p className="text-xs text-muted-foreground">0 = sem limite. O limite próprio do sócio, quando definido no cadastro, tem prioridade.</p>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong>Regra atual:</strong>{" "}
          {!enabled || limit === 0
            ? "o titular pode agendar sem restrição de quantidade."
            : period === "monthly"
              ? <>o titular pode agendar no máximo <strong>{limit}</strong> consulta(s) por profissional por mês.</>
              : <>o titular pode agendar no máximo <strong>{limit}</strong> consulta(s) com o mesmo profissional dentro de qualquer intervalo de <strong>{periodText}</strong>.</>}
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
