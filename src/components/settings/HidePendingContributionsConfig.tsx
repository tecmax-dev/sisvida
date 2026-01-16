import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, EyeOff, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function HidePendingContributionsConfig() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [hidePendingBeforeDate, setHidePendingBeforeDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [hiddenCount, setHiddenCount] = useState<number>(0);

  // Load current setting
  useEffect(() => {
    const loadSetting = async () => {
      if (!currentClinic?.id) return;

      const { data, error } = await supabase
        .from("clinics")
        .select("hide_pending_before_date")
        .eq("id", currentClinic.id)
        .single();

      if (!error && data?.hide_pending_before_date) {
        setHidePendingBeforeDate(new Date(data.hide_pending_before_date));
      }
    };

    loadSetting();
  }, [currentClinic?.id]);

  // Count hidden contributions when date changes
  useEffect(() => {
    const countHidden = async () => {
      if (!currentClinic?.id || !hidePendingBeforeDate) {
        setHiddenCount(0);
        return;
      }

      const dateStr = format(hidePendingBeforeDate, "yyyy-MM-dd");
      const { count, error } = await supabase
        .from("employer_contributions")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", currentClinic.id)
        .in("status", ["pending", "overdue"])
        .lt("due_date", dateStr);

      if (!error && count !== null) {
        setHiddenCount(count);
      }
    };

    countHidden();
  }, [currentClinic?.id, hidePendingBeforeDate]);

  const handleSave = async () => {
    if (!currentClinic?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({
          hide_pending_before_date: hidePendingBeforeDate
            ? format(hidePendingBeforeDate, "yyyy-MM-dd")
            : null,
        })
        .eq("id", currentClinic.id);

      if (error) throw error;

      toast({
        title: "Configuração salva",
        description: hidePendingBeforeDate
          ? `Contribuições pendentes anteriores a ${format(hidePendingBeforeDate, "dd/MM/yyyy")} serão ocultadas.`
          : "Todas as contribuições pendentes serão exibidas.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!currentClinic?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({ hide_pending_before_date: null })
        .eq("id", currentClinic.id);

      if (error) throw error;

      setHidePendingBeforeDate(undefined);
      toast({
        title: "Configuração removida",
        description: "Todas as contribuições pendentes serão exibidas.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EyeOff className="h-5 w-5" />
          Ocultar Pendências Antigas
        </CardTitle>
        <CardDescription>
          Configure uma data limite para ocultar contribuições pendentes ou vencidas anteriores a esta data. 
          Útil para evitar exibição de débitos em processo de conciliação ou auditoria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            Esta configuração afeta a visibilidade em todas as listagens, portais do empregador 
            e contador. Os dados não são excluídos, apenas ocultados temporariamente.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Ocultar pendências anteriores a:</Label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !hidePendingBeforeDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {hidePendingBeforeDate ? (
                    format(hidePendingBeforeDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  ) : (
                    "Selecione uma data"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={hidePendingBeforeDate}
                  onSelect={setHidePendingBeforeDate}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {hidePendingBeforeDate && (
              <Button variant="ghost" size="icon" onClick={handleClear} disabled={saving}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>

        {hidePendingBeforeDate && hiddenCount > 0 && (
          <p className="text-sm text-muted-foreground">
            <strong>{hiddenCount.toLocaleString("pt-BR")}</strong> contribuição(ões) pendente(s) ou vencida(s) 
            serão ocultadas com esta configuração.
          </p>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </CardContent>
    </Card>
  );
}
