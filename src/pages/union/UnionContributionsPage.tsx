import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";

export default function UnionContributionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contribuições</h1>
        <p className="text-muted-foreground">
          Gerencie as contribuições sindicais
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-500" />
            Gerenciamento de Contribuições
          </CardTitle>
          <CardDescription>
            Lista de contribuições do módulo sindical
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de contribuições em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar contribuições aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
