import { Calendar, Clock, User, Video, Phone, MoreHorizontal, Plus } from "lucide-react";

const mockAppointments = [
  { 
    time: "09:00", 
    endTime: "09:30",
    patient: "Maria Silva", 
    type: "Primeira Consulta",
    status: "confirmed",
    statusLabel: "Confirmado",
    avatar: "MS",
    avatarColor: "bg-emerald-100 text-emerald-700",
  },
  { 
    time: "10:30", 
    endTime: "11:00",
    patient: "Pedro Santos", 
    type: "Retorno",
    status: "scheduled",
    statusLabel: "Aguardando",
    avatar: "PS",
    avatarColor: "bg-amber-100 text-amber-700",
  },
  { 
    time: "14:00", 
    endTime: "14:45",
    patient: "Ana Oliveira", 
    type: "Teleconsulta",
    status: "in_progress",
    statusLabel: "Em atendimento",
    avatar: "AO",
    avatarColor: "bg-primary/10 text-primary",
    isTelemedicine: true,
  },
  { 
    time: "15:30", 
    endTime: "16:00",
    patient: "Carlos Mendes", 
    type: "Procedimento",
    status: "confirmed",
    statusLabel: "Confirmado",
    avatar: "CM",
    avatarColor: "bg-sky-100 text-sky-700",
  },
];

const getStatusStyles = (status: string) => {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-600 border-emerald-200";
    case "scheduled":
      return "bg-amber-50 text-amber-600 border-amber-200";
    case "in_progress":
      return "bg-primary/10 text-primary border-primary/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export function AgendaMockup() {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <div className="w-full max-w-md bg-background border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-float">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Agenda</h3>
              <p className="text-xs text-muted-foreground capitalize">{formattedDate}</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Novo
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          <div className="flex-1 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/30">
            <p className="text-lg font-bold text-foreground">4</p>
            <p className="text-[10px] text-muted-foreground">Consultas hoje</p>
          </div>
          <div className="flex-1 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/30">
            <p className="text-lg font-bold text-emerald-600">3</p>
            <p className="text-[10px] text-muted-foreground">Confirmados</p>
          </div>
          <div className="flex-1 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/30">
            <p className="text-lg font-bold text-primary">1</p>
            <p className="text-[10px] text-muted-foreground">Em andamento</p>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="p-3 space-y-2 max-h-[300px] overflow-hidden bg-muted/20">
        {mockAppointments.map((appointment, index) => (
          <div 
            key={index}
            className={`group bg-background rounded-xl p-3 border transition-all duration-200 hover:shadow-md ${
              appointment.status === 'in_progress' 
                ? 'border-primary/30 ring-1 ring-primary/10' 
                : 'border-border/50 hover:border-primary/20'
            }`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ${appointment.avatarColor}`}>
                {appointment.avatar}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground text-sm truncate">{appointment.patient}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getStatusStyles(appointment.status)}`}>
                    {appointment.statusLabel}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{appointment.time} - {appointment.endTime}</span>
                  </div>
                  <span className="text-border">•</span>
                  <span>{appointment.type}</span>
                  {appointment.isTelemedicine && (
                    <>
                      <span className="text-border">•</span>
                      <Video className="h-3 w-3 text-primary" />
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/5 border-t border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-xs text-muted-foreground">
            Próxima consulta em <span className="font-medium text-foreground">45 min</span>
          </p>
        </div>
        <button className="text-xs text-primary font-medium hover:underline">
          Ver agenda completa
        </button>
      </div>
    </div>
  );
}
