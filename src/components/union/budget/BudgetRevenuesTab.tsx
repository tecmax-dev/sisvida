import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { BudgetRevenue, revenueTypeLabels } from "@/types/unionBudget";
import { toast } from "sonner";

interface BudgetRevenuesTabProps {
  revenues: BudgetRevenue[];
  clinicId?: string;
  versionId?: string;
  isEditable: boolean;
  onCreate: (data: Partial<BudgetRevenue>) => void;
  onUpdate: (data: Partial<BudgetRevenue> & { id: string }) => void;
  onDelete: (id: string) => void;
}

export function BudgetRevenuesTab({
  revenues,
  clinicId,
  versionId,
  isEditable,
  onCreate,
  onUpdate,
  onDelete,
}: BudgetRevenuesTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalBudgeted = revenues.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta receita?')) {
      onDelete(id);
      toast.success('Receita excluída com sucesso');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Receitas Previstas</h3>
          <p className="text-sm text-muted-foreground">
            Total: {formatCurrency(totalBudgeted)}
          </p>
        </div>
        {isEditable && (
          <Button onClick={() => {}}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Receita
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Total Previsto</TableHead>
                {isEditable && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isEditable ? 5 : 4} className="text-center text-muted-foreground py-8">
                    Nenhuma receita cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                revenues.map((revenue) => (
                  <TableRow key={revenue.id}>
                    <TableCell className="font-medium">{revenue.description || '-'}</TableCell>
                    <TableCell>{revenueTypeLabels[revenue.revenue_type] || revenue.revenue_type}</TableCell>
                    <TableCell>{revenue.category_name || '-'}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {formatCurrency(revenue.total_amount)}
                    </TableCell>
                    {isEditable && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(revenue.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
