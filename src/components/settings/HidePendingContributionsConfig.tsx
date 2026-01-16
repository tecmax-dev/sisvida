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
import { CalendarIcon, EyeOff, Trash2, AlertTriangle, Search } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function HidePendingContributionsConfig() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [hidePendingBeforeDate, setHidePendingBeforeDate] = useState<Date | undefined>();
  const [dateInputValue, setDateInputValue] = useState("");
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
        const date = new Date(data.hide_pending_before_date);
        setHidePendingBeforeDate(date);
        setDateInputValue(format(date, "dd/MM/yyyy"));
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

  // Handle typed date input
  const handleDateInputChange = (value: string) => {
    setDateInputValue(value);
    
    // Try to parse the date when input is complete (dd/MM/yyyy = 10 chars)
    if (value.length === 10) {
      const parsed = parse(value, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        setHidePendingBeforeDate(parsed);
      }
    }
  };

  // Handle calendar selection
  const handleCalendarSelect = (date: Date | undefined) => {
    setHidePendingBeforeDate(date);
    if (date) {
      setDateInputValue(format(date, "dd/MM/yyyy"));
    } else {
      setDateInputValue("");
    }
  };

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
      setDateInputValue("");
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
          <div className="flex gap-2 items-center">
            {/* Input para digitar data */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="DD/MM/AAAA"
                value={dateInputValue}
                onChange={(e) => handleDateInputChange(e.target.value)}
                className="pl-9 w-[140px]"
                maxLength={10}
              />
            </div>

            {/* Calendar picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                >
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={hidePendingBeforeDate}
                  onSelect={handleCalendarSelect}
                  initialFocus
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
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
