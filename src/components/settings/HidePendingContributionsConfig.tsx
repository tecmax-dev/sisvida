import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EyeOff, Trash2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper to format competence as MM/YYYY
const formatCompetence = (month: number, year: number): string => {
  return `${String(month).padStart(2, "0")}/${year}`;
};

// Helper to parse competence from MM/YYYY string
const parseCompetence = (value: string): { month: number; year: number } | null => {
  const match = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  if (month < 1 || month > 12 || year < 2020 || year > 2099) return null;
  return { month, year };
};

export function HidePendingContributionsConfig() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  
  // Start competence (De:)
  const [startMonth, setStartMonth] = useState<number | undefined>();
  const [startYear, setStartYear] = useState<number | undefined>();
  const [startInput, setStartInput] = useState("");
  
  // End competence (Até:)
  const [endMonth, setEndMonth] = useState<number | undefined>();
  const [endYear, setEndYear] = useState<number | undefined>();
  const [endInput, setEndInput] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [hiddenCount, setHiddenCount] = useState<number>(0);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i);
  const months = [
    { value: 1, label: "01 - Janeiro" },
    { value: 2, label: "02 - Fevereiro" },
    { value: 3, label: "03 - Março" },
    { value: 4, label: "04 - Abril" },
    { value: 5, label: "05 - Maio" },
    { value: 6, label: "06 - Junho" },
    { value: 7, label: "07 - Julho" },
    { value: 8, label: "08 - Agosto" },
    { value: 9, label: "09 - Setembro" },
    { value: 10, label: "10 - Outubro" },
    { value: 11, label: "11 - Novembro" },
    { value: 12, label: "12 - Dezembro" },
  ];

  // Load current setting - parse from stored date
  useEffect(() => {
    const loadSetting = async () => {
      if (!currentClinic?.id) return;

      const { data, error } = await supabase
        .from("clinics")
        .select("hide_pending_before_date")
        .eq("id", currentClinic.id)
        .single();

      if (!error && data?.hide_pending_before_date) {
        // Parse stored date as end competence (YYYY-MM-DD -> month/year)
        const date = new Date(data.hide_pending_before_date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        setEndMonth(month);
        setEndYear(year);
        setEndInput(formatCompetence(month, year));
      }
    };

    loadSetting();
  }, [currentClinic?.id]);

  // Count hidden contributions when competences change
  useEffect(() => {
    const countHidden = async () => {
      if (!currentClinic?.id) {
        setHiddenCount(0);
        return;
      }
      
      const hasStart = startMonth && startYear;
      const hasEnd = endMonth && endYear;
      
      if (!hasStart && !hasEnd) {
        setHiddenCount(0);
        return;
      }

      // Build filter based on competence (year * 100 + month for easy comparison)
      const startValue = hasStart ? startYear! * 100 + startMonth! : 0;
      const endValue = hasEnd ? endYear! * 100 + endMonth! : 999999;

      const { data, error } = await supabase
        .from("employer_contributions")
        .select("competence_month, competence_year")
        .eq("clinic_id", currentClinic.id)
        .in("status", ["pending", "overdue"]);

      if (!error && data) {
        const filtered = data.filter((c) => {
          const compValue = c.competence_year * 100 + c.competence_month;
          return compValue >= startValue && compValue <= endValue;
        });
        setHiddenCount(filtered.length);
      }
    };

    countHidden();
  }, [currentClinic?.id, startMonth, startYear, endMonth, endYear]);

  // Handle typed input for start competence
  const handleStartInputChange = (value: string) => {
    setStartInput(value);
    if (value.length >= 6) {
      const parsed = parseCompetence(value);
      if (parsed) {
        setStartMonth(parsed.month);
        setStartYear(parsed.year);
      }
    }
  };

  // Handle typed input for end competence
  const handleEndInputChange = (value: string) => {
    setEndInput(value);
    if (value.length >= 6) {
      const parsed = parseCompetence(value);
      if (parsed) {
        setEndMonth(parsed.month);
        setEndYear(parsed.year);
      }
    }
  };

  // Handle select changes for start
  const handleStartMonthChange = (value: string) => {
    const month = parseInt(value, 10);
    setStartMonth(month);
    if (startYear) {
      setStartInput(formatCompetence(month, startYear));
    }
  };

  const handleStartYearChange = (value: string) => {
    const year = parseInt(value, 10);
    setStartYear(year);
    if (startMonth) {
      setStartInput(formatCompetence(startMonth, year));
    }
  };

  // Handle select changes for end
  const handleEndMonthChange = (value: string) => {
    const month = parseInt(value, 10);
    setEndMonth(month);
    if (endYear) {
      setEndInput(formatCompetence(month, endYear));
    }
  };

  const handleEndYearChange = (value: string) => {
    const year = parseInt(value, 10);
    setEndYear(year);
    if (endMonth) {
      setEndInput(formatCompetence(endMonth, year));
    }
  };

  const handleSave = async () => {
    if (!currentClinic?.id) return;

    setSaving(true);
    try {
      // Store as first day of the month for the end competence (backwards compatibility)
      const hideDate = endMonth && endYear
        ? `${endYear}-${String(endMonth).padStart(2, "0")}-01`
        : null;

      const { error } = await supabase
        .from("clinics")
        .update({ hide_pending_before_date: hideDate })
        .eq("id", currentClinic.id);

      if (error) throw error;

      const hasStart = startMonth && startYear;
      const hasEnd = endMonth && endYear;
      
      const startStr = hasStart ? formatCompetence(startMonth!, startYear!) : "";
      const endStr = hasEnd ? formatCompetence(endMonth!, endYear!) : "";
      
      const rangeStr = hasStart && hasEnd
        ? `de ${startStr} a ${endStr}`
        : hasEnd
        ? `até ${endStr}`
        : hasStart
        ? `a partir de ${startStr}`
        : "";

      toast({
        title: "Configuração salva",
        description: rangeStr
          ? `Contribuições pendentes da competência ${rangeStr} serão ocultadas.`
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

      setStartMonth(undefined);
      setStartYear(undefined);
      setStartInput("");
      setEndMonth(undefined);
      setEndYear(undefined);
      setEndInput("");
      
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

  const hasAnyValue = startMonth || startYear || endMonth || endYear;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EyeOff className="h-5 w-5" />
          Ocultar Pendências por Competência
        </CardTitle>
        <CardDescription>
          Configure um intervalo de competências (mês/ano) para ocultar contribuições pendentes ou vencidas.
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

        <div className="space-y-4">
          <Label>Ocultar pendências da competência:</Label>
          
          {/* Start competence (De:) */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground w-8">De:</span>
            <Input
              type="text"
              placeholder="MM/AAAA"
              value={startInput}
              onChange={(e) => handleStartInputChange(e.target.value)}
              className="w-[100px]"
              maxLength={7}
            />
            <span className="text-sm text-muted-foreground">ou</span>
            <Select value={startMonth?.toString() || ""} onValueChange={handleStartMonthChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={startYear?.toString() || ""} onValueChange={handleStartYearChange}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* End competence (Até:) */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground w-8">Até:</span>
            <Input
              type="text"
              placeholder="MM/AAAA"
              value={endInput}
              onChange={(e) => handleEndInputChange(e.target.value)}
              className="w-[100px]"
              maxLength={7}
            />
            <span className="text-sm text-muted-foreground">ou</span>
            <Select value={endMonth?.toString() || ""} onValueChange={handleEndMonthChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={endYear?.toString() || ""} onValueChange={handleEndYearChange}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {hasAnyValue && (
              <Button variant="ghost" size="icon" onClick={handleClear} disabled={saving}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>

        {hasAnyValue && hiddenCount > 0 && (
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
