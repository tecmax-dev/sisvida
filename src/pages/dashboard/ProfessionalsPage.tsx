import { useState } from "react";
import { 
  Plus, 
  MoreVertical,
  Clock,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const professionals = [
  {
    id: 1,
    name: "Dr. Carlos Mendes",
    specialty: "Clínico Geral",
    crm: "123456-SP",
    schedule: "Seg-Sex: 08:00-18:00",
    appointmentsToday: 8,
    status: "available",
  },
  {
    id: 2,
    name: "Dra. Paula Santos",
    specialty: "Cardiologia",
    crm: "654321-SP",
    schedule: "Seg-Qua-Sex: 09:00-17:00",
    appointmentsToday: 5,
    status: "busy",
  },
  {
    id: 3,
    name: "Dr. Roberto Lima",
    specialty: "Ortopedia",
    crm: "789012-SP",
    schedule: "Ter-Qui: 08:00-16:00",
    appointmentsToday: 0,
    status: "unavailable",
  },
  {
    id: 4,
    name: "Dra. Mariana Costa",
    specialty: "Dermatologia",
    crm: "345678-SP",
    schedule: "Seg-Sex: 10:00-19:00",
    appointmentsToday: 6,
    status: "available",
  },
];

const statusConfig = {
  available: { label: "Disponível", variant: "default" as const },
  busy: { label: "Em atendimento", variant: "secondary" as const },
  unavailable: { label: "Indisponível", variant: "outline" as const },
};

export default function ProfessionalsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
          <p className="text-muted-foreground">
            Gerencie os profissionais da clínica
          </p>
        </div>
        <Button variant="hero">
          <Plus className="h-4 w-4 mr-2" />
          Novo Profissional
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {professionals.map((professional) => {
          const status = statusConfig[professional.status as keyof typeof statusConfig];
          
          return (
            <Card key={professional.id} className="card-hover">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-semibold text-primary">
                        {professional.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {professional.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {professional.specialty}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        CRM: {professional.crm}
                      </p>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Ver agenda</DropdownMenuItem>
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem>Configurar horários</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Desativar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {professional.schedule}
                      </span>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {professional.appointmentsToday} consultas hoje
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
