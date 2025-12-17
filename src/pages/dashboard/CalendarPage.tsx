import { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const appointments = [
  { time: "08:00", patient: "Maria Silva", type: "Primeira Consulta", professional: "Dr. Carlos" },
  { time: "09:00", patient: "João Santos", type: "Retorno", professional: "Dr. Carlos" },
  { time: "10:30", patient: "Ana Oliveira", type: "Exame", professional: "Dra. Paula" },
  { time: "14:00", patient: "Pedro Lima", type: "Retorno", professional: "Dr. Carlos" },
  { time: "15:30", patient: "Lucia Ferreira", type: "Primeira Consulta", professional: "Dra. Paula" },
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false });
    }
    
    return days;
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const isToday = (day: number, isCurrentMonth: boolean) => {
    const today = new Date();
    return (
      isCurrentMonth &&
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number, isCurrentMonth: boolean) => {
    return (
      isCurrentMonth &&
      day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">
            Gerencie os agendamentos da clínica
          </p>
        </div>
        <Button variant="hero">
          <Plus className="h-4 w-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              {weekDays.map((day) => (
                <div key={day} className="py-2 text-muted-foreground font-medium">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentDate).map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (item.isCurrentMonth) {
                      setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), item.day));
                    }
                  }}
                  className={cn(
                    "aspect-square flex items-center justify-center text-sm rounded-lg transition-colors",
                    item.isCurrentMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/40",
                    isToday(item.day, item.isCurrentMonth) &&
                      "bg-primary/10 text-primary font-semibold",
                    isSelected(item.day, item.isCurrentMonth) &&
                      "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {item.day}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              Agendamentos - {selectedDate.toLocaleDateString("pt-BR", { 
                weekday: "long",
                day: "numeric",
                month: "long"
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments.map((appointment, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all cursor-pointer group"
                >
                  <div className="w-20 text-center py-2 rounded-lg bg-primary/10">
                    <span className="text-sm font-semibold text-primary">
                      {appointment.time}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      {appointment.patient}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {appointment.type}
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {appointment.professional}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Editar
                  </Button>
                </div>
              ))}
              
              {appointments.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhum agendamento para este dia</p>
                  <Button variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar agendamento
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
