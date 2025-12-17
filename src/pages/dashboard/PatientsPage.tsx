import { useState } from "react";
import { 
  Search, 
  Plus, 
  Phone, 
  Mail,
  MoreVertical,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const patients = [
  {
    id: 1,
    name: "Maria Silva",
    email: "maria.silva@email.com",
    phone: "(11) 99999-1234",
    insurance: "Unimed",
    lastVisit: "15/12/2024",
    nextVisit: "20/01/2025",
  },
  {
    id: 2,
    name: "João Santos",
    email: "joao.santos@email.com",
    phone: "(11) 98888-5678",
    insurance: "Bradesco Saúde",
    lastVisit: "10/12/2024",
    nextVisit: null,
  },
  {
    id: 3,
    name: "Ana Oliveira",
    email: "ana.oliveira@email.com",
    phone: "(11) 97777-9012",
    insurance: "Particular",
    lastVisit: "05/12/2024",
    nextVisit: "18/01/2025",
  },
  {
    id: 4,
    name: "Carlos Souza",
    email: "carlos.souza@email.com",
    phone: "(11) 96666-3456",
    insurance: "SulAmérica",
    lastVisit: "01/12/2024",
    nextVisit: "15/01/2025",
  },
  {
    id: 5,
    name: "Lucia Ferreira",
    email: "lucia.ferreira@email.com",
    phone: "(11) 95555-7890",
    insurance: "Amil",
    lastVisit: "28/11/2024",
    nextVisit: null,
  },
];

export default function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro dos seus pacientes
          </p>
        </div>
        <Button variant="hero">
          <Plus className="h-4 w-4 mr-2" />
          Novo Paciente
        </Button>
      </div>

      {/* Search and filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filteredPatients.length} paciente{filteredPatients.length !== 1 ? "s" : ""} encontrado{filteredPatients.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-lg font-semibold text-primary">
                    {patient.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{patient.name}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {patient.email}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {patient.phone}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-1">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
                    {patient.insurance}
                  </span>
                  {patient.nextVisit && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Próxima: {patient.nextVisit}
                    </span>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Ver perfil</DropdownMenuItem>
                    <DropdownMenuItem>Agendar consulta</DropdownMenuItem>
                    <DropdownMenuItem>Editar</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {filteredPatients.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhum paciente encontrado</p>
                <Button variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar paciente
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
