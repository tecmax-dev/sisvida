import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileBarChart } from "lucide-react";

export default function UnionReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">
          Relatórios financeiros do módulo sindical
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-blue-500" />
            Relatórios Sindicais
          </CardTitle>
          <CardDescription>
            Gere relatórios financeiros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FileBarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de relatórios em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerar relatórios aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
