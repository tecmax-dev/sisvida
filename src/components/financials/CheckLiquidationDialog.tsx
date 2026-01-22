import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, FileCheck, Building2, AlertCircle } from "lucide-react";

interface CheckLiquidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function CheckLiquidationDialog({
  open,
  onOpenChange,
  clinicId,
}: CheckLiquidationDialogProps) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [checkNumber, setCheckNumber] = useState("");
  const [searchedCheckNumber, setSearchedCheckNumber] = useState("");
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [liquidationDate, setLiquidationDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [cashRegisterId, setCashRegisterId] = useState("");

  // Fetch expenses by check number
  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses-by-check", clinicId, searchedCheckNumber],
    queryFn: async () => {
      if (!searchedCheckNumber) return [] as any[];

      const { data, error } = await (supabase
        .from("financial_transactions")
        .select(`
          *,
          suppliers (name),
          cash_registers (name, bank_name)
        `)
        .eq("clinic_id", clinicId)
        .eq("type", "expense") as any)
        .eq("check_number", searchedCheckNumber)
        .in("status", ["pending", "overdue"])
        .order("due_date");

      if (error) throw error;
      return data as any[];
    },
    enabled: !!searchedCheckNumber,
  });

  // Fetch cash registers
  const { data: cashRegisters } = useQuery({
    queryKey: ["cash-registers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Calculate selected totals
  const selectedTotal = useMemo(() => {
    if (!expenses) return 0;
    return expenses
      .filter((e) => selectedExpenses.includes(e.id))
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [expenses, selectedExpenses]);

  // Liquidation mutation
  const liquidateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExpenses.length) {
        throw new Error("Selecione ao menos uma despesa");
      }

      if (!cashRegisterId) {
        throw new Error("Selecione a conta bancária");
      }

      // Update all selected expenses
      const { error: updateError } = await supabase
        .from("financial_transactions")
        .update({
          status: "paid",
          paid_date: liquidationDate,
          liquidation_date: liquidationDate,
          liquidated_by: session?.user?.id,
          cash_register_id: cashRegisterId,
        })
        .in("id", selectedExpenses);

      if (updateError) throw updateError;

      // Create liquidation history record
      const { error: historyError } = await supabase
        .from("expense_liquidation_history")
        .insert({
          clinic_id: clinicId,
          check_number: searchedCheckNumber,
          liquidation_date: liquidationDate,
          cash_register_id: cashRegisterId,
          liquidated_by: session?.user?.id,
          transaction_ids: selectedExpenses,
          total_value: selectedTotal,
        });

      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-by-check"] });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
      toast.success(`${selectedExpenses.length} despesa(s) liquidada(s) com sucesso!`);
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao liquidar despesas");
    },
  });

  const handleSearch = () => {
    if (checkNumber.trim()) {
      setSearchedCheckNumber(checkNumber.trim());
      setSelectedExpenses([]);
    }
  };

  const handleClose = () => {
    setCheckNumber("");
    setSearchedCheckNumber("");
    setSelectedExpenses([]);
    setLiquidationDate(format(new Date(), "yyyy-MM-dd"));
    setCashRegisterId("");
    onOpenChange(false);
  };

  const toggleExpense = (id: string) => {
    setSelectedExpenses((prev) =>
      prev.includes(id)
        ? prev.filter((e) => e !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (expenses) {
      setSelectedExpenses(expenses.map((e) => e.id));
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <PopupBase open={open} onClose={handleClose} maxWidth="3xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          Liquidação por Cheque
        </PopupTitle>
        <PopupDescription>
          Busque por número de cheque e liquide múltiplas despesas de uma vez.
        </PopupDescription>
      </PopupHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="checkNumber">Número do Cheque</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="checkNumber"
                  placeholder="Digite o número do cheque"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={!checkNumber.trim()}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
            </div>
          </div>

          {/* Results */}
          {searchedCheckNumber && (
            <>
              {loadingExpenses ? (
                <div className="text-center py-8 text-muted-foreground">
                  Buscando despesas...
                </div>
              ) : expenses && expenses.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {expenses.length} despesa(s) encontrada(s) para o cheque{" "}
                      <Badge variant="outline">{searchedCheckNumber}</Badge>
                    </p>
                    <Button variant="link" size="sm" onClick={selectAll}>
                      Selecionar todas
                    </Button>
                  </div>

                  <ScrollArea className="max-h-[250px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((expense) => (
                          <TableRow
                            key={expense.id}
                            className={
                              selectedExpenses.includes(expense.id)
                                ? "bg-primary/5"
                                : ""
                            }
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedExpenses.includes(expense.id)}
                                onCheckedChange={() => toggleExpense(expense.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {expense.description}
                            </TableCell>
                            <TableCell>
                              {(expense.suppliers as any)?.name || "-"}
                            </TableCell>
                            <TableCell>
                              {expense.due_date
                                ? format(
                                    parseISO(expense.due_date),
                                    "dd/MM/yyyy",
                                    { locale: ptBR }
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-600">
                              {formatCurrency(Number(expense.amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Liquidation Details */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Data de Liquidação</Label>
                          <Input
                            type="date"
                            value={liquidationDate}
                            onChange={(e) => setLiquidationDate(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>Conta Bancária (Portador)</Label>
                          <Select
                            value={cashRegisterId}
                            onValueChange={setCashRegisterId}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Selecione a conta" />
                            </SelectTrigger>
                            <SelectContent>
                              {cashRegisters?.map((register) => (
                                <SelectItem key={register.id} value={register.id}>
                                  <span className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    {register.name}
                                    {register.bank_name && (
                                      <span className="text-muted-foreground">
                                        ({register.bank_name})
                                      </span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-background rounded-md border">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Despesas selecionadas
                            </p>
                            <p className="text-lg font-bold">
                              {selectedExpenses.length} de {expenses.length}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              Total a liquidar
                            </p>
                            <p className="text-2xl font-bold text-red-600">
                              {formatCurrency(selectedTotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma despesa pendente encontrada para o cheque{" "}
                    <Badge variant="outline">{searchedCheckNumber}</Badge>
                  </p>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => liquidateMutation.mutate()}
              disabled={
                !selectedExpenses.length ||
                !cashRegisterId ||
                liquidateMutation.isPending
              }
            >
              {liquidateMutation.isPending
                ? "Liquidando..."
                : `Liquidar ${selectedExpenses.length} Despesa(s)`}
            </Button>
          </div>
        </div>
    </PopupBase>
  );
}
