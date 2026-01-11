import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function UnionMembersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sócios</h1>
        <p className="text-muted-foreground">
          Gerencie os sócios/associados do sindicato
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Sócios
          </CardTitle>
          <CardDescription>
            Lista de sócios cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de sócios em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar sócios aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
