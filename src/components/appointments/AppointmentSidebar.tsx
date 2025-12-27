import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, Play, Square, Eye, EyeOff, FileText, ClipboardList, Stethoscope, Pill, TestTube } from "lucide-react";

interface AppointmentSidebarProps {
  appointmentStatus: string;
  startedAt: string | null;
  onStartAppointment: () => void;
  onFinishAppointment: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppointmentSidebar({
  appointmentStatus,
  startedAt,
  onStartAppointment,
  onFinishAppointment,
  activeTab,
  onTabChange,
}: AppointmentSidebarProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showTimer, setShowTimer] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (appointmentStatus === 'in_progress' && startedAt) {
      const startTime = new Date(startedAt).getTime();
      
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      };
      
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    } else {
      setElapsedTime(0);
    }
  }, [appointmentStatus, startedAt]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const tabs = [
    { id: 'resumo', label: 'Resumo', icon: FileText },
    { id: 'anamnese', label: 'Anamnese', icon: ClipboardList },
    { id: 'evolucoes', label: 'Evoluções', icon: Stethoscope },
    { id: 'prescricoes', label: 'Prescrições', icon: Pill },
    { id: 'exames', label: 'Exames', icon: TestTube },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Prontuários</h2>
      </div>

      {/* Timer Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">Duração da consulta</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowTimer(!showTimer)}
          >
            {showTimer ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>

        {showTimer && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Clock className="h-6 w-6 text-primary" />
            <span className="text-3xl font-mono font-bold text-foreground">
              {formatTime(elapsedTime)}
            </span>
          </div>
        )}

        {appointmentStatus === 'in_progress' ? (
          <Button
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={onFinishAppointment}
          >
            <Square className="h-4 w-4 mr-2" />
            Finalizar Atendimento
          </Button>
        ) : appointmentStatus === 'completed' ? (
          <Button className="w-full" disabled variant="secondary">
            Atendimento Finalizado
          </Button>
        ) : (
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={onStartAppointment}
          >
            <Play className="h-4 w-4 mr-2" />
            Iniciar Atendimento
          </Button>
        )}
      </div>

      {/* Navigation Tabs */}
      <nav className="flex-1 p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
