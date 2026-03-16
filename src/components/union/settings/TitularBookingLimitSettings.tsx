import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TitularBookingLimitSettingsProps {
  clinicId: string;
  currentEnabled: boolean;
  onUpdate: () => void;
  isAdmin: boolean;
}

export function TitularBookingLimitSettings({
  clinicId,
  currentEnabled,
  onUpdate,
  isAdmin,
}: TitularBookingLimitSettingsProps) {
  const [enabled, setEnabled] = useState(currentEnabled);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          Limite de Agendamento do Titular
        </CardTitle>
        <CardDescription>
          Controla se o titular (sócio) pode agendar apenas 1 consulta por profissional por mês
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="titular-enabled" className="text-sm font-medium">Ativar regra de limite</Label>
            <p className="text-xs text-muted-foreground">
              Quando ativada, limita 1 agendamento por profissional por mês no painel e no app (PWA)
            </p>
          </div>
          <Switch
            id="titular-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!isAdmin}
          />
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <strong>Status:</strong> Regra {enabled ? "ativada" : "desativada"} — o titular{" "}
          {enabled ? "pode agendar no máximo 1 consulta por profissional por mês" : "pode agendar sem restrição de quantidade"}.
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
