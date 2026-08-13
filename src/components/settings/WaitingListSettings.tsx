import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ListOrdered } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";

/**
 * Configurações → Agendamentos → Fila de Espera
 * Visível e editável apenas para Administrador Master / Gestor Admin.
 */
export function WaitingListSettings() {
  const { currentClinic } = useAuth();
  const { isAdmin } = usePermissions();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [timeout, setTimeoutMinutes] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!currentClinic?.id) return;
      const { data } = await supabase
        .from("clinics")
        .select("waiting_list_enabled, waiting_list_offer_timeout_minutes")
        .eq("id", currentClinic.id)
        .maybeSingle();
      if (data) {
        setEnabled(!!(data as any).waiting_list_enabled);
        setTimeoutMinutes((data as any).waiting_list_offer_timeout_minutes ?? 30);
      }
      setLoading(false);
    };
    load();
  }, [currentClinic?.id]);

  if (!isAdmin) return null;

  const save = async (nextEnabled: boolean, nextTimeout: number) => {
    if (!currentClinic?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({
          waiting_list_enabled: nextEnabled,
          waiting_list_offer_timeout_minutes: Math.max(5, Math.min(1440, nextTimeout || 30)),
        } as any)
        .eq("id", currentClinic.id);
      if (error) throw error;

      await supabase.from("waiting_list_logs" as any).insert({
        clinic_id: currentClinic.id,
        action: "settings_toggled",
        actor_type: "staff",
        details: { enabled: nextEnabled, timeout_minutes: nextTimeout },
      });

      toast({
        title: "Configuração salva",
        description: nextEnabled
          ? "Fila de Espera Automática ativada."
          : "Fila de Espera Automática desativada.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListOrdered className="h-5 w-5 text-primary" />
          Fila de Espera
        </CardTitle>
        <CardDescription>
          Permite que associados entrem em fila de espera quando não existirem vagas para um profissional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <Label>Fila de Espera Automática</Label>
          <RadioGroup
            value={enabled ? "on" : "off"}
            onValueChange={(v) => {
              const next = v === "on";
              setEnabled(next);
              save(next, timeout);
            }}
            disabled={loading || saving}
            className="flex flex-col gap-2 sm:flex-row sm:gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="off" id="wl-off" />
              <Label htmlFor="wl-off" className="font-normal cursor-pointer">Desativada</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="on" id="wl-on" />
              <Label htmlFor="wl-on" className="font-normal cursor-pointer">Ativada</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wl-timeout">Tempo máximo de resposta da oferta (minutos)</Label>
          <div className="flex items-center gap-3">
            <Input
              id="wl-timeout"
              type="number"
              min={5}
              max={1440}
              value={timeout}
              onChange={(e) => setTimeoutMinutes(parseInt(e.target.value) || 0)}
              className="w-32"
              disabled={loading || saving}
            />
            <Button variant="outline" size="sm" disabled={saving} onClick={() => save(enabled, timeout)}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Após esse prazo a oferta expira automaticamente e a vaga é oferecida ao próximo da fila.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}