import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";

export default function UnionCashFlowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fluxo de Caixa</h1>
        <p className="text-muted-foreground">
          Acompanhe o fluxo de caixa do módulo sindical
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-500" />
            Fluxo de Caixa Sindical
          </CardTitle>
          <CardDescription>
            Movimentações financeiras
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Fluxo de caixa em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá visualizar o fluxo aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
