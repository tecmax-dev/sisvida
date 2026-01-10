import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Download, CheckSquare, XSquare, Check } from "lucide-react";

interface Holiday {
  name: string;
  date: string;
  type: "national" | "state";
  isImported: boolean;
}

interface BrazilianState {
  code: string;
  name: string;
}

export default function HolidayImportSection() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedState, setSelectedState] = useState("");
  const [includeStateHolidays, setIncludeStateHolidays] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [states, setStates] = useState<BrazilianState[]>([]);
  const [selectedHolidays, setSelectedHolidays] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate year options (current year - 1 to current year + 5)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i);

  // Fetch holidays when year or state changes
  useEffect(() => {
    fetchHolidays();
  }, [selectedYear, selectedState, includeStateHolidays, currentClinic?.id]);

  const fetchHolidays = async () => {
    if (!currentClinic?.id) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("fetch-brazilian-holidays", {
        body: {
          clinic_id: currentClinic.id,
          year: selectedYear,
          state: includeStateHolidays ? selectedState : undefined,
        },
      });

      if (invokeError) throw invokeError;

      setHolidays(data?.holidays || []);
      setStates(data?.states || []);
      setSelectedHolidays(new Set()); // Reset selection on new fetch
    } catch (err: any) {
      console.error("Error fetching holidays:", err);
      setError(err?.message || "Erro ao carregar feriados");
    } finally {
      setIsLoading(false);
    }
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (dates: string[]) => {
      const { data, error } = await supabase.functions.invoke("fetch-brazilian-holidays", {
        body: {
          clinic_id: currentClinic?.id,
          year: selectedYear,
          state: includeStateHolidays ? selectedState : undefined,
          import_holidays: true,
          selected_dates: dates,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["homologacao-blocks"] });
      toast.success(`${data.imported} feriados importados com sucesso!`);
      fetchHolidays(); // Refresh to update imported status
    },
    onError: (error: any) => {
      toast.error("Erro ao importar feriados: " + error.message);
    },
  });

  const toggleHoliday = (date: string) => {
    const newSelected = new Set(selectedHolidays);
    if (newSelected.has(date)) {
      newSelected.delete(date);
    } else {
      newSelected.add(date);
    }
    setSelectedHolidays(newSelected);
  };

  const selectAll = () => {
    const notImported = holidays.filter(h => !h.isImported).map(h => h.date);
    setSelectedHolidays(new Set(notImported));
  };

  const clearSelection = () => {
    setSelectedHolidays(new Set());
  };

  const handleImport = () => {
    const dates = Array.from(selectedHolidays);
    if (dates.length === 0) {
      toast.error("Selecione pelo menos um feriado para importar");
      return;
    }
    importMutation.mutate(dates);
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  const notImportedCount = holidays.filter(h => !h.isImported).length;
  const selectedCount = selectedHolidays.size;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Importar Feriados
        </CardTitle>
        <CardDescription>
          Carregue automaticamente feriados nacionais e estaduais para bloquear na agenda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Ano</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={selectedState}
              onValueChange={setSelectedState}
              disabled={!includeStateHolidays}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {states.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Switch
                id="include-state"
                checked={includeStateHolidays}
                onCheckedChange={setIncludeStateHolidays}
              />
              <Label htmlFor="include-state" className="text-sm">
                Incluir feriados estaduais
              </Label>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={selectAll}
            disabled={notImportedCount === 0}
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            Selecionar todos
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearSelection}
            disabled={selectedCount === 0}
          >
            <XSquare className="w-4 h-4 mr-1" />
            Limpar seleção
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={selectedCount === 0 || importMutation.isPending}
          >
            <Download className="w-4 h-4 mr-1" />
            {importMutation.isPending 
              ? "Importando..." 
              : `Importar selecionados (${selectedCount})`}
          </Button>
        </div>

        {/* Holidays list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchHolidays}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {holidays.map((holiday) => (
                <div
                  key={holiday.date}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    holiday.isImported 
                      ? "bg-muted/50 border-muted" 
                      : selectedHolidays.has(holiday.date)
                        ? "bg-primary/5 border-primary/30"
                        : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={holiday.date}
                      checked={selectedHolidays.has(holiday.date)}
                      onCheckedChange={() => toggleHoliday(holiday.date)}
                      disabled={holiday.isImported}
                    />
                    <div>
                      <div className="font-medium">{holiday.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(holiday.date)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={holiday.type === "national" ? "secondary" : "outline"}
                      className={holiday.type === "national" ? "bg-purple-100 text-purple-700 hover:bg-purple-100" : ""}
                    >
                      {holiday.type === "national" ? "Nacional" : "Estadual"}
                    </Badge>
                    {holiday.isImported && (
                      <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500">
                        <Check className="w-3 h-3 mr-1" />
                        Importado
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {holidays.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum feriado encontrado para o período selecionado
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
