import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { BudgetExpense, expenseTypeLabels } from "@/types/unionBudget";
import { toast } from "sonner";

interface BudgetExpensesTabProps {
  expenses: BudgetExpense[];
  clinicId?: string;
  versionId?: string;
  isEditable: boolean;
  onCreate: (data: Partial<BudgetExpense>) => void;
  onUpdate: (data: Partial<BudgetExpense> & { id: string }) => void;
  onDelete: (id: string) => void;
}

export function BudgetExpensesTab({
  expenses,
  clinicId,
  versionId,
  isEditable,
  onCreate,
  onUpdate,
  onDelete,
}: BudgetExpensesTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalBudgeted = expenses.reduce((sum, e) => sum + (e.total_amount || 0), 0);

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
      onDelete(id);
      toast.success('Despesa excluída com sucesso');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Despesas Previstas</h3>
          <p className="text-sm text-muted-foreground">
            Total: {formatCurrency(totalBudgeted)}
          </p>
        </div>
        {isEditable && (
          <Button onClick={() => {}}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
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
                <TableHead>Centro de Custo</TableHead>
                <TableHead className="text-right">Total Previsto</TableHead>
                {isEditable && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isEditable ? 5 : 4} className="text-center text-muted-foreground py-8">
                    Nenhuma despesa cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.description || '-'}</TableCell>
                    <TableCell>{expenseTypeLabels[expense.expense_type] || expense.expense_type}</TableCell>
                    <TableCell>{expense.cost_center_name || '-'}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {formatCurrency(expense.total_amount)}
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
                            onClick={() => handleDelete(expense.id)}
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
