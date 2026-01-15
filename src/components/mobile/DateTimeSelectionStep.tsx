import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  CalendarDays,
  Clock,
  Check,
} from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  appointment_duration: number;
  schedule: any;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface DateTimeSelectionStepProps {
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  availableSlots: TimeSlot[];
  professionals: Professional[];
  selectedProfessionalId: string;
  isDateEnabled: (date: Date, professional: Professional | undefined) => boolean;
  submitting: boolean;
  onSubmit: () => void;
}

export function DateTimeSelectionStep({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  availableSlots,
  professionals,
  selectedProfessionalId,
  isDateEnabled,
  submitting,
  onSubmit,
}: DateTimeSelectionStepProps) {
  const professional = professionals.find(p => p.id === selectedProfessionalId);

  // Generate available dates for the next 60 days
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    
    for (let i = 0; i < 60; i++) {
      const date = addDays(today, i);
      if (isDateEnabled(date, professional)) {
        dates.push(date);
      }
    }
    
    return dates;
  }, [professional, isDateEnabled]);

  const availableTimeSlots = availableSlots.filter(s => s.available);

  return (
    <div className="space-y-6">
      {/* Date Selection */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-foreground">Escolha a data</h2>
        </div>
        
        {availableDates.length > 0 ? (
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {availableDates.map((date) => {
                const isSelected = selectedDate && format(selectedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
                return (
                  <Card
                    key={format(date, "yyyy-MM-dd")}
                    className={`cursor-pointer flex-shrink-0 min-w-[80px] transition-all ${
                      isSelected 
                        ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600" 
                        : "hover:border-emerald-300"
                    }`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <CardContent className="p-3 text-center">
                      <p className={`text-xs font-medium uppercase ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {format(date, "EEE", { locale: ptBR })}
                      </p>
                      <p className={`text-xl font-bold ${isSelected ? "text-emerald-700" : "text-foreground"}`}>
                        {format(date, "dd")}
                      </p>
                      <p className={`text-xs ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {format(date, "MMM", { locale: ptBR })}
                      </p>
                      {isSelected && (
                        <Check className="h-4 w-4 text-emerald-600 mx-auto mt-1" />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-6 bg-muted/50 rounded-lg">
            <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhuma data disponível para este profissional.</p>
          </div>
        )}
      </div>

      {/* Time Selection */}
      {selectedDate && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-foreground">Escolha o horário</h2>
          </div>
          
          <p className="text-sm text-muted-foreground mb-3">
            {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>

          {availableTimeSlots.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {availableTimeSlots.map((slot) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <Card
                    key={slot.time}
                    className={`cursor-pointer transition-all ${
                      isSelected 
                        ? "border-emerald-600 bg-emerald-600 text-white" 
                        : "hover:border-emerald-300"
                    }`}
                    onClick={() => setSelectedTime(slot.time)}
                  >
                    <CardContent className="p-3 text-center">
                      <p className={`text-sm font-semibold ${isSelected ? "text-white" : "text-foreground"}`}>
                        {slot.time}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 bg-muted/50 rounded-lg">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Nenhum horário disponível para esta data.</p>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <Button 
        className="w-full bg-emerald-600 hover:bg-emerald-700"
        disabled={!selectedDate || !selectedTime || submitting}
        onClick={onSubmit}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Agendando...
          </>
        ) : (
          "Confirmar Agendamento"
        )}
      </Button>
    </div>
  );
}
