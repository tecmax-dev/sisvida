import { 
  Calendar, 
  Users, 
  Clock, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const stats = [
  {
    title: "Consultas Hoje",
    value: "12",
    change: "+2 vs ontem",
    icon: Calendar,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Pacientes Ativos",
    value: "248",
    change: "+18 este mês",
    icon: Users,
    color: "text-info",
    bgColor: "bg-info/10",
  },
  {
    title: "Taxa de Presença",
    value: "92%",
    change: "+5% vs mês passado",
    icon: TrendingUp,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    title: "Tempo Médio",
    value: "28min",
    change: "Por consulta",
    icon: Clock,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
];

const todayAppointments = [
  { time: "08:00", patient: "Maria Silva", type: "Primeira Consulta", status: "confirmed" },
  { time: "09:00", patient: "João Santos", type: "Retorno", status: "confirmed" },
  { time: "10:00", patient: "Ana Oliveira", type: "Exame", status: "pending" },
  { time: "11:00", patient: "Carlos Souza", type: "Retorno", status: "confirmed" },
  { time: "14:00", patient: "Lucia Ferreira", type: "Primeira Consulta", status: "cancelled" },
  { time: "15:00", patient: "Pedro Lima", type: "Retorno", status: "pending" },
];

const statusConfig = {
  confirmed: { icon: CheckCircle2, color: "text-success", label: "Confirmado" },
  pending: { icon: AlertCircle, color: "text-warning", label: "Aguardando" },
  cancelled: { icon: XCircle, color: "text-destructive", label: "Cancelado" },
};

export default function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta! Aqui está o resumo da sua clínica.
          </p>
        </div>
        <Button variant="hero" asChild>
          <Link to="/dashboard/calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Nova Consulta
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.change}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Consultas de Hoje</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/calendar">Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todayAppointments.map((appointment, i) => {
              const status = statusConfig[appointment.status as keyof typeof statusConfig];
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors ${
                    appointment.status === "cancelled" ? "opacity-60" : ""
                  }`}
                >
                  <div className="w-16 text-center">
                    <span className="text-sm font-semibold text-foreground">
                      {appointment.time}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {appointment.patient}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${status.color}`} />
                    <span className={`text-sm ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
