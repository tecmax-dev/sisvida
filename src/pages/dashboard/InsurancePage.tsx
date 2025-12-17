import { 
  Plus, 
  MoreVertical,
  Users,
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

const insurances = [
  {
    id: 1,
    name: "Unimed",
    patients: 45,
    procedures: ["Consulta", "Retorno", "Exames básicos"],
    status: "active",
  },
  {
    id: 2,
    name: "Bradesco Saúde",
    patients: 32,
    procedures: ["Consulta", "Retorno", "Exames"],
    status: "active",
  },
  {
    id: 3,
    name: "SulAmérica",
    patients: 28,
    procedures: ["Consulta", "Retorno"],
    status: "active",
  },
  {
    id: 4,
    name: "Amil",
    patients: 18,
    procedures: ["Consulta", "Retorno", "Procedimentos"],
    status: "active",
  },
  {
    id: 5,
    name: "Particular",
    patients: 125,
    procedures: ["Todos os procedimentos"],
    status: "active",
  },
];

export default function InsurancePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Convênios</h1>
          <p className="text-muted-foreground">
            Gerencie os convênios aceitos pela clínica
          </p>
        </div>
        <Button variant="hero">
          <Plus className="h-4 w-4 mr-2" />
          Novo Convênio
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insurances.map((insurance) => (
          <Card key={insurance.id} className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground text-lg">
                    {insurance.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {insurance.patients} pacientes
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Editar</DropdownMenuItem>
                    <DropdownMenuItem>Ver pacientes</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Desativar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Procedimentos</p>
                <div className="flex flex-wrap gap-2">
                  {insurance.procedures.map((proc, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {proc}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
