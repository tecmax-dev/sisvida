import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Handshake } from "lucide-react";

export default function UnionNegotiationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Negociações</h1>
        <p className="text-muted-foreground">
          Gerencie as negociações de débitos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-purple-500" />
            Acordos e Negociações
          </CardTitle>
          <CardDescription>
            Lista de negociações ativas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Handshake className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de negociações em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar acordos aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
