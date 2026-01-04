import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface TimeSlotPickerProps {
  // Todos os slots disponíveis na escala do profissional
  allSlots: string[];
  // Agendamentos existentes do profissional para a data selecionada
  existingAppointments: Array<{
    start_time: string;
    end_time: string;
    status: string;
  }>;
  // Horário selecionado
  selectedTime: string;
  onSelectTime: (time: string) => void;
  // Múltiplos horários para recorrência
  multiSelectEnabled?: boolean;
  selectedTimes?: string[];
  onSelectMultiple?: (times: string[]) => void;
  // Duração do agendamento em minutos
  duration: number;
  // Para desabilitar interação
  disabled?: boolean;
}

export function TimeSlotPicker({
  allSlots,
  existingAppointments,
  selectedTime,
  onSelectTime,
  multiSelectEnabled = false,
  selectedTimes = [],
  onSelectMultiple,
  duration,
  disabled = false,
}: TimeSlotPickerProps) {
  // Calcular quais slots estão ocupados
  const slotStatus = useMemo(() => {
    const status: Record<string, 'free' | 'booked'> = {};
    
    // Filtrar agendamentos ativos
    const activeAppointments = existingAppointments.filter(
      apt => apt.status !== 'cancelled' && apt.status !== 'no_show'
    );
    
    for (const slotTime of allSlots) {
      const [h, m] = slotTime.split(':').map(Number);
      const slotMinutes = h * 60 + m;
      const slotEndMinutes = slotMinutes + duration;
      
      // Verificar se há algum agendamento que conflita com este slot
      const hasConflict = activeAppointments.some(apt => {
        const [aptStartH, aptStartM] = apt.start_time.substring(0, 5).split(':').map(Number);
        const [aptEndH, aptEndM] = apt.end_time.substring(0, 5).split(':').map(Number);
        const aptStartMinutes = aptStartH * 60 + aptStartM;
        const aptEndMinutes = aptEndH * 60 + aptEndM;
        
        // Conflito se os intervalos se sobrepõem
        return slotMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes;
      });
      
      status[slotTime] = hasConflict ? 'booked' : 'free';
    }
    
    return status;
  }, [allSlots, existingAppointments, duration]);

  // Apenas slots livres
  const freeSlots = useMemo(() => {
    return allSlots.filter(slot => slotStatus[slot] === 'free');
  }, [allSlots, slotStatus]);

  const handleSlotClick = (time: string) => {
    if (disabled || slotStatus[time] === 'booked') return;
    
    if (multiSelectEnabled && onSelectMultiple) {
      const newSelection = selectedTimes.includes(time)
        ? selectedTimes.filter(t => t !== time)
        : [...selectedTimes, time].sort();
      onSelectMultiple(newSelection);
      // Também define o primeiro como o principal
      if (newSelection.length > 0 && !newSelection.includes(selectedTime)) {
        onSelectTime(newSelection[0]);
      }
    } else {
      onSelectTime(time);
    }
  };

  const handleSelectAll = () => {
    if (!multiSelectEnabled || !onSelectMultiple) return;
    onSelectMultiple(freeSlots);
    if (freeSlots.length > 0) {
      onSelectTime(freeSlots[0]);
    }
  };

  const handleClearAll = () => {
    if (!multiSelectEnabled || !onSelectMultiple) return;
    onSelectMultiple([]);
    onSelectTime("");
  };

  if (freeSlots.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Horário *</Label>
        <div className="border rounded-lg p-4 bg-muted/50 text-center">
          <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum horário disponível para esta data
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Todos os horários estão ocupados ou o profissional não atende neste dia
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Horário * {multiSelectEnabled && <span className="text-muted-foreground font-normal">(selecione múltiplos)</span>}</Label>
        {multiSelectEnabled && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-primary hover:underline"
              disabled={disabled}
            >
              Selecionar todos
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:underline"
              disabled={disabled}
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      <ScrollArea className="h-[180px] border rounded-lg bg-background">
        <div className="p-2 grid grid-cols-4 gap-1.5">
          {freeSlots.map((time) => {
            const isSelected = multiSelectEnabled 
              ? selectedTimes.includes(time)
              : selectedTime === time;
            
            return (
              <button
                key={time}
                type="button"
                onClick={() => handleSlotClick(time)}
                disabled={disabled}
                className={cn(
                  "relative flex items-center justify-center py-2 px-1 rounded-md text-sm font-medium transition-all",
                  "border hover:border-primary/50 hover:bg-primary/5",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                    : "bg-background border-border text-foreground",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Clock className="h-3 w-3 mr-1.5 opacity-70" />
                {time}
                {isSelected && multiSelectEnabled && (
                  <Check className="absolute top-0.5 right-0.5 h-3 w-3" />
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {multiSelectEnabled && selectedTimes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-xs text-muted-foreground">Selecionados:</span>
          {selectedTimes.map(time => (
            <Badge
              key={time}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-destructive/20"
              onClick={() => handleSlotClick(time)}
            >
              {time} ×
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {freeSlots.length} horário(s) disponível(is) • {duration} min cada
      </p>
    </div>
  );
}
