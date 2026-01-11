import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown } from "lucide-react";

export default function UnionExpensesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Despesas</h1>
        <p className="text-muted-foreground">
          Gerencie as despesas do módulo sindical
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-rose-500" />
            Despesas Sindicais
          </CardTitle>
          <CardDescription>
            Lista de despesas registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de despesas em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar despesas aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
