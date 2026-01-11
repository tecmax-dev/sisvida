import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function UnionFinancialsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro Sindical</h1>
        <p className="text-muted-foreground">
          Visão geral do financeiro do módulo sindical
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-500" />
            Visão Geral Financeira
          </CardTitle>
          <CardDescription>
            Resumo das finanças sindicais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo financeiro sindical em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar finanças aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
