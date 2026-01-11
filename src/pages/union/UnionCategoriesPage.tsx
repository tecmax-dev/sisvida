import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function UnionCategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
        <p className="text-muted-foreground">
          Gerencie as categorias financeiras do módulo sindical
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-500" />
            Categorias Financeiras
          </CardTitle>
          <CardDescription>
            Lista de categorias de receitas e despesas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Módulo de categorias em implementação</p>
            <p className="text-sm mt-2">Em breve você poderá gerenciar categorias aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
