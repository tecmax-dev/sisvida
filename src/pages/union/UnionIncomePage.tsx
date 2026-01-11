import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function UnionIncomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Receitas</h1>
        <p className="text-muted-foreground">
          Gerencie as receitas do módulo sindical
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Receitas Sindicais
          </CardTitle>
          <CardDescription>
            Lista de receitas registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de receitas em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar receitas aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
