import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

export default function UnionCashRegistersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contas Bancárias</h1>
        <p className="text-muted-foreground">
          Gerencie as contas/portadores do módulo sindical
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-500" />
            Portadores Sindicais
          </CardTitle>
          <CardDescription>
            Lista de contas bancárias e caixas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de contas em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar portadores aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
