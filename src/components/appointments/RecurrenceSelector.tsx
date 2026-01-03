import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Repeat, Calendar, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";
export type RecurrenceLimitType = "sessions" | "date";

export interface RecurrenceConfig {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  limitType: RecurrenceLimitType;
  sessions: number;
  endDate: string;
}

interface RecurrenceSelectorProps {
  value: RecurrenceConfig;
  onChange: (config: RecurrenceConfig) => void;
  minDate?: string;
  className?: string;
}

const frequencyLabels: Record<RecurrenceFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

const frequencyDescriptions: Record<RecurrenceFrequency, string> = {
  weekly: "Repete toda semana",
  biweekly: "Repete a cada 2 semanas",
  monthly: "Repete uma vez por mês",
};

export function RecurrenceSelector({ value, onChange, minDate, className }: RecurrenceSelectorProps) {
  const handleToggle = (enabled: boolean) => {
    onChange({ ...value, enabled });
  };

  const handleFrequencyChange = (frequency: RecurrenceFrequency) => {
    onChange({ ...value, frequency });
  };

  const handleLimitTypeChange = (limitType: RecurrenceLimitType) => {
    onChange({ ...value, limitType });
  };

  const handleSessionsChange = (sessions: number) => {
    onChange({ ...value, sessions: Math.max(2, Math.min(52, sessions)) });
  };

  const handleEndDateChange = (endDate: string) => {
    onChange({ ...value, endDate });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toggle principal */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Repeat className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Label htmlFor="recurrence-toggle" className="font-medium cursor-pointer">
              Agendamento Recorrente
            </Label>
            <p className="text-xs text-muted-foreground">
              Repete automaticamente nos próximos dias
            </p>
          </div>
        </div>
        <Switch
          id="recurrence-toggle"
          checked={value.enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {/* Opções de recorrência (visíveis quando ativo) */}
      {value.enabled && (
        <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Frequência */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Frequência</Label>
            <Select value={value.frequency} onValueChange={(v) => handleFrequencyChange(v as RecurrenceFrequency)}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(frequencyLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span>{label}</span>
                      <span className="text-xs text-muted-foreground">
                        {frequencyDescriptions[key as RecurrenceFrequency]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de limite */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Repetir até</Label>
            <RadioGroup
              value={value.limitType}
              onValueChange={(v) => handleLimitTypeChange(v as RecurrenceLimitType)}
              className="space-y-2"
            >
              {/* Opção: Número de sessões */}
              <div 
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  value.limitType === "sessions" 
                    ? "border-primary bg-primary/5" 
                    : "border-border/50 hover:bg-muted/50"
                )}
                onClick={() => handleLimitTypeChange("sessions")}
              >
                <RadioGroupItem value="sessions" id="limit-sessions" className="mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="limit-sessions" className="font-medium cursor-pointer">
                      Número de sessões
                    </Label>
                  </div>
                  {value.limitType === "sessions" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={2}
                        max={52}
                        value={value.sessions}
                        onChange={(e) => handleSessionsChange(parseInt(e.target.value) || 2)}
                        className="w-20 h-8 text-center bg-background"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm text-muted-foreground">sessões</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Opção: Data final */}
              <div 
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  value.limitType === "date" 
                    ? "border-primary bg-primary/5" 
                    : "border-border/50 hover:bg-muted/50"
                )}
                onClick={() => handleLimitTypeChange("date")}
              >
                <RadioGroupItem value="date" id="limit-date" className="mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="limit-date" className="font-medium cursor-pointer">
                      Até uma data
                    </Label>
                  </div>
                  {value.limitType === "date" && (
                    <Input
                      type="date"
                      min={minDate}
                      value={value.endDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full h-8 bg-background"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Preview */}
          <div className="p-3 rounded-md bg-background border border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Resumo:</span>{" "}
              {value.frequency === "weekly" && "Toda semana"}
              {value.frequency === "biweekly" && "A cada 2 semanas"}
              {value.frequency === "monthly" && "Uma vez por mês"}
              {value.limitType === "sessions" && `, ${value.sessions} sessões no total`}
              {value.limitType === "date" && value.endDate && `, até ${new Date(value.endDate + "T12:00:00").toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility function to calculate recurring dates
export function calculateRecurringDates(
  startDate: Date,
  config: RecurrenceConfig
): Date[] {
  if (!config.enabled) return [startDate];

  const dates: Date[] = [new Date(startDate)];
  let currentDate = new Date(startDate);
  
  const getNextDate = (date: Date, frequency: RecurrenceFrequency): Date => {
    const next = new Date(date);
    switch (frequency) {
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "biweekly":
        next.setDate(next.getDate() + 14);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  };

  if (config.limitType === "sessions") {
    // Gerar N sessões
    for (let i = 1; i < config.sessions; i++) {
      currentDate = getNextDate(currentDate, config.frequency);
      dates.push(new Date(currentDate));
    }
  } else {
    // Gerar até a data final
    const endDate = new Date(config.endDate + "T23:59:59");
    while (true) {
      currentDate = getNextDate(currentDate, config.frequency);
      if (currentDate > endDate) break;
      dates.push(new Date(currentDate));
      // Safety limit
      if (dates.length >= 52) break;
    }
  }

  return dates;
}
