import { Calendar, ChevronDown, Check, Clock, User, Video } from "lucide-react";

const mockProfessionals = [
  { name: "Dr. João Silva", specialty: "Clínico Geral", selected: true },
  { name: "Dra. Ana Costa", specialty: "Dermatologia", selected: false },
  { name: "Dr. Carlos Lima", specialty: "Ortopedia", selected: false },
];

const mockAppointments = [
  { 
    time: "09:00", 
    patient: "Maria Silva", 
    type: "Primeira Consulta",
    professional: "Dr. João Silva",
    status: "confirmed",
    statusLabel: "Confirmado",
    statusColor: "bg-success",
    textColor: "text-success",
  },
  { 
    time: "10:30", 
    patient: "Pedro Santos", 
    type: "Retorno",
    professional: "Dra. Ana Costa",
    status: "scheduled",
    statusLabel: "Aguardando",
    statusColor: "bg-warning",
    textColor: "text-warning",
  },
  { 
    time: "14:00", 
    patient: "Ana Oliveira", 
    type: "Teleconsulta",
    professional: "Dr. João Silva",
    status: "in_progress",
    statusLabel: "Em atendimento",
    statusColor: "bg-primary",
    textColor: "text-primary",
    isTelemedicine: true,
  },
  { 
    time: "15:30", 
    patient: "Carlos Mendes", 
    type: "Procedimento",
    professional: "Dr. Carlos Lima",
    status: "confirmed",
    statusLabel: "Confirmado",
    statusColor: "bg-success",
    textColor: "text-success",
  },
];

export function AgendaMockup() {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-float">
      {/* Header */}
      <div className="bg-primary/5 border-b border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Agenda de Hoje</h3>
              <p className="text-xs text-muted-foreground capitalize">{formattedDate}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-card px-2 py-1 rounded-full border border-border">
            4 consultas
          </div>
        </div>

        {/* Dropdown (sempre aberto) */}
        <div className="relative">
          <button className="w-full flex items-center justify-between px-3 py-2 bg-card border border-primary/30 rounded-lg text-sm">
            <span className="text-foreground font-medium">Dr. João Silva</span>
            <ChevronDown className="h-4 w-4 text-primary" />
          </button>
          
          {/* Dropdown menu aberto */}
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden">
            {mockProfessionals.map((prof, index) => (
              <div 
                key={index}
                className={`flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors ${
                  prof.selected ? 'bg-primary/5' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{prof.name}</p>
                  <p className="text-xs text-muted-foreground">{prof.specialty}</p>
                </div>
                {prof.selected && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="p-3 space-y-2 max-h-[320px] overflow-hidden">
        {mockAppointments.map((appointment, index) => (
          <div 
            key={index}
            className="group bg-card border border-border rounded-xl p-3 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start gap-3">
              {/* Time indicator */}
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full ${appointment.statusColor}`} />
                <div className="w-px h-full bg-border mt-1" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-foreground text-sm">{appointment.time}</span>
                    {appointment.isTelemedicine && (
                      <Video className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${appointment.textColor}`}>
                    {appointment.statusLabel}
                  </span>
                </div>

                <p className="font-medium text-foreground text-sm truncate">{appointment.patient}</p>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{appointment.type}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate">{appointment.professional}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-muted/30 border-t border-border px-4 py-2">
        <p className="text-xs text-muted-foreground text-center">
          Próxima consulta em <span className="font-medium text-primary">45 min</span>
        </p>
      </div>
    </div>
  );
}
