import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function UnionEmployersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cadastro de Empresas</h1>
        <p className="text-muted-foreground">
          Gerencie as empresas vinculadas ao sindicato
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-500" />
            Empresas
          </CardTitle>
          <CardDescription>
            Lista de empresas cadastradas no módulo sindical
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de empresas em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar empresas aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
