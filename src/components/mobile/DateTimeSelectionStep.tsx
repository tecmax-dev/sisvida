import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Loader2, 
  CalendarDays,
  Clock,
  Check,
  AlertTriangle,
} from "lucide-react";
import { format, addDays, startOfDay, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  bookingMonthsAhead?: number;
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
  bookingMonthsAhead = 1,
}: DateTimeSelectionStepProps) {
  const professional = professionals.find(p => p.id === selectedProfessionalId);

  // Calcular data limite baseada em bookingMonthsAhead
  // bookingMonthsAhead = 1 significa apenas mês atual
  // bookingMonthsAhead = 2 significa mês atual + próximo, etc.
  const lastAllowedDate = useMemo(() => {
    const today = startOfDay(new Date());
    return endOfMonth(addMonths(today, bookingMonthsAhead - 1));
  }, [bookingMonthsAhead]);

  // Gerar datas disponíveis limitadas por bookingMonthsAhead
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    
    // Loop através dos dias até atingir o limite
    for (let i = 0; i < 365; i++) { // Max 1 ano para evitar loops infinitos
      const date = addDays(today, i);
      
      // Parar se ultrapassou os meses permitidos
      if (date > lastAllowedDate) break;
      
      if (isDateEnabled(date, professional)) {
        dates.push(date);
      }
    }
    
    return dates;
  }, [professional, isDateEnabled, lastAllowedDate]);

  const availableTimeSlots = availableSlots.filter(s => s.available);
  
  // Verificar se há restrição de meses ativa (para exibir mensagem)
  const hasMonthRestriction = bookingMonthsAhead < 12;

  return (
    <div className="space-y-6">
      {/* Mensagem de restrição de período (se aplicável) */}
      {hasMonthRestriction && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Agendamentos disponíveis apenas até {format(lastAllowedDate, "dd/MM/yyyy", { locale: ptBR })}
          </AlertDescription>
        </Alert>
      )}

      {/* Date Selection */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-foreground">Escolha a data</h2>
        </div>
        
        {availableDates.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {availableDates.map((date) => {
              const isSelected = selectedDate && format(selectedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
              return (
                <Card
                  key={format(date, "yyyy-MM-dd")}
                  className={`cursor-pointer transition-all ${
                    isSelected 
                      ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600" 
                      : "hover:border-emerald-300"
                  }`}
                  onClick={() => setSelectedDate(date)}
                >
                  <CardContent className="p-2 sm:p-3 text-center">
                    <p className={`text-[10px] sm:text-xs font-medium uppercase ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {format(date, "EEE", { locale: ptBR })}
                    </p>
                    <p className={`text-lg sm:text-xl font-bold ${isSelected ? "text-emerald-700" : "text-foreground"}`}>
                      {format(date, "dd")}
                    </p>
                    <p className={`text-[10px] sm:text-xs ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {format(date, "MMM", { locale: ptBR })}
                    </p>
                    {isSelected && (
                      <Check className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 mx-auto mt-0.5" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 bg-muted/50 rounded-lg">
            <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">
              {hasMonthRestriction 
                ? "Agendamento indisponível para este período"
                : "Nenhuma data disponível para este profissional."
              }
            </p>
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
