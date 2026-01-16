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
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function HidePendingContributionsConfig() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
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
        // For backwards compatibility, use saved date as end date
        const date = new Date(data.hide_pending_before_date);
        setEndDate(date);
        setEndDateInput(format(date, "dd/MM/yyyy"));
      }
    };

    loadSetting();
  }, [currentClinic?.id]);

  // Count hidden contributions when dates change
  useEffect(() => {
    const countHidden = async () => {
      if (!currentClinic?.id || (!startDate && !endDate)) {
        setHiddenCount(0);
        return;
      }

      let query = supabase
        .from("employer_contributions")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", currentClinic.id)
        .in("status", ["pending", "overdue"]);

      if (startDate) {
        query = query.gte("due_date", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        query = query.lt("due_date", format(endDate, "yyyy-MM-dd"));
      }

      const { count, error } = await query;

      if (!error && count !== null) {
        setHiddenCount(count);
      }
    };

    countHidden();
  }, [currentClinic?.id, startDate, endDate]);

  // Handle typed date input for start date
  const handleStartDateInputChange = (value: string) => {
    setStartDateInput(value);
    if (value.length === 10) {
      const parsed = parse(value, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        setStartDate(parsed);
      }
    }
  };

  // Handle typed date input for end date
  const handleEndDateInputChange = (value: string) => {
    setEndDateInput(value);
    if (value.length === 10) {
      const parsed = parse(value, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        setEndDate(parsed);
      }
    }
  };

  // Handle calendar selection for start date
  const handleStartCalendarSelect = (date: Date | undefined) => {
    setStartDate(date);
    if (date) {
      setStartDateInput(format(date, "dd/MM/yyyy"));
    } else {
      setStartDateInput("");
    }
  };

  // Handle calendar selection for end date
  const handleEndCalendarSelect = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      setEndDateInput(format(date, "dd/MM/yyyy"));
    } else {
      setEndDateInput("");
    }
  };

  const handleSave = async () => {
    if (!currentClinic?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({
          hide_pending_before_date: endDate
            ? format(endDate, "yyyy-MM-dd")
            : null,
        })
        .eq("id", currentClinic.id);

      if (error) throw error;

      const dateRange = startDate && endDate
        ? `de ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`
        : endDate
        ? `anteriores a ${format(endDate, "dd/MM/yyyy")}`
        : startDate
        ? `a partir de ${format(startDate, "dd/MM/yyyy")}`
        : "";

      toast({
        title: "Configuração salva",
        description: dateRange
          ? `Contribuições pendentes ${dateRange} serão ocultadas.`
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

      setStartDate(undefined);
      setEndDate(undefined);
      setStartDateInput("");
      setEndDateInput("");
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
          <Label>Ocultar pendências no período:</Label>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Start date */}
            <span className="text-sm text-muted-foreground">De:</span>
            <div className="relative">
              <Input
                type="text"
                placeholder="DD/MM/AAAA"
                value={startDateInput}
                onChange={(e) => handleStartDateInputChange(e.target.value)}
                className="w-[130px]"
                maxLength={10}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleStartCalendarSelect}
                  initialFocus
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* End date */}
            <span className="text-sm text-muted-foreground">a:</span>
            <div className="relative">
              <Input
                type="text"
                placeholder="DD/MM/AAAA"
                value={endDateInput}
                onChange={(e) => handleEndDateInputChange(e.target.value)}
                className="w-[130px]"
                maxLength={10}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={handleEndCalendarSelect}
                  initialFocus
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {(startDate || endDate) && (
              <Button variant="ghost" size="icon" onClick={handleClear} disabled={saving}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>

        {(startDate || endDate) && hiddenCount > 0 && (
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
