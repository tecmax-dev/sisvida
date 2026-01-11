import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FinancialExportButton } from "./FinancialExportButton";
import { ExpenseDialog } from "./ExpenseDialog";
import { CheckLiquidationDialog } from "./CheckLiquidationDialog";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreHorizontal,
  Check,
  X,
  Trash2,
  Edit,
  FileText,
  Wallet,
  AlertCircle,
  TrendingDown,
  Clock,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ExpensesListPanelProps {
  clinicId: string;
}

const statusLabels: Record<string, string> = {
  pending: "Em Aberto",
  paid: "Liquidada",
  cancelled: "Cancelada",
  overdue: "Vencida",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  cancelled: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Dinheiro",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  pix: "PIX",
  bank_transfer: "Transferência",
  check: "Cheque",
  boleto: "Boleto",
};

export function ExpensesListPanel({ clinicId }: ExpensesListPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [checkNumberFilter, setCheckNumberFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [cashRegisterFilter, setCashRegisterFilter] = useState<string>("all");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [checkLiquidationOpen, setCheckLiquidationOpen] = useState(false);

  // Fetch expenses
  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          financial_categories (name, color),
          suppliers (name, cnpj),
          cash_registers (name, bank_name)
        `)
        .eq("clinic_id", clinicId)
        .eq("type", "expense")
        .order("due_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers for filter
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch cash registers for filter
  const { data: cashRegisters } = useQuery({
    queryKey: ["cash-registers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("id, name, bank_name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "paid") {
        updates.paid_date = format(new Date(), "yyyy-MM-dd");
        updates.liquidation_date = format(new Date(), "yyyy-MM-dd");
      }

      const { error } = await supabase
        .from("financial_transactions")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      toast.success("Status atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      toast.success("Despesa excluída!");
    },
    onError: () => {
      toast.error("Erro ao excluir despesa");
    },
  });

  // Process expenses with overdue status
  const processedExpenses = useMemo(() => {
    if (!expenses) return [];

    const today = startOfDay(new Date());

    return expenses.map((expense) => {
      let effectiveStatus = expense.status;

      if (expense.status === "pending" && expense.due_date) {
        const dueDate = startOfDay(parseISO(expense.due_date));
        if (isAfter(today, dueDate)) {
          effectiveStatus = "overdue";
        }
      }

      return { ...expense, effectiveStatus };
    });
  }, [expenses]);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return processedExpenses.filter((expense: any) => {
      // Search filter
      const matchesSearch =
        expense.description.toLowerCase().includes(search.toLowerCase()) ||
        expense.document_number?.toLowerCase().includes(search.toLowerCase()) ||
        expense.suppliers?.name?.toLowerCase().includes(search.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || expense.effectiveStatus === statusFilter;

      // Supplier filter
      const matchesSupplier =
        supplierFilter === "all" || expense.supplier_id === supplierFilter;

      // Check number filter
      const matchesCheckNumber =
        !checkNumberFilter ||
        expense.check_number?.includes(checkNumberFilter);

      // Cash register filter
      const matchesCashRegister =
        cashRegisterFilter === "all" ||
        expense.cash_register_id === cashRegisterFilter;

      // Date range filter
      let matchesDateRange = true;
      if (startDateFilter && expense.due_date) {
        matchesDateRange = expense.due_date >= startDateFilter;
      }
      if (endDateFilter && expense.due_date) {
        matchesDateRange = matchesDateRange && expense.due_date <= endDateFilter;
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSupplier &&
        matchesCheckNumber &&
        matchesCashRegister &&
        matchesDateRange
      );
    });
  }, [
    processedExpenses,
    search,
    statusFilter,
    supplierFilter,
    checkNumberFilter,
    cashRegisterFilter,
    startDateFilter,
    endDateFilter,
  ]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredExpenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );
    const paid = filteredExpenses
      .filter((e) => e.status === "paid")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const pending = filteredExpenses
      .filter((e) => e.effectiveStatus === "pending")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const overdue = filteredExpenses
      .filter((e) => e.effectiveStatus === "overdue")
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return { total, paid, pending, overdue };
  }, [filteredExpenses]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setCheckNumberFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setCashRegisterFilter("all");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Despesas</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie as despesas e contas a pagar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCheckLiquidationOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Liquidar por Cheque
          </Button>
          <Button onClick={() => navigate("/dashboard/financials/new?type=expense")}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-500" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
            <p className="text-xs text-muted-foreground">
              {filteredExpenses.length} despesas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Liquidadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totals.paid)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(totals.pending)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.overdue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, documento ou fornecedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <FinancialExportButton
                onExportPDF={() => {}}
                onExportExcel={() => {}}
                disabled={!filteredExpenses.length}
              />
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </div>
        </CardHeader>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent>
            <CardContent className="border-t pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Em Aberto</SelectItem>
                      <SelectItem value="overdue">Vencidas</SelectItem>
                      <SelectItem value="paid">Liquidadas</SelectItem>
                      <SelectItem value="cancelled">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Fornecedor</Label>
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {suppliers?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Portador</Label>
                  <Select value={cashRegisterFilter} onValueChange={setCashRegisterFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {cashRegisters?.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Nº Cheque</Label>
                  <Input
                    placeholder="Buscar cheque"
                    value={checkNumberFilter}
                    onChange={(e) => setCheckNumberFilter(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs">Data Inicial</Label>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs">Data Final</Label>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>

        {/* Table */}
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            {filteredExpenses.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Nº Doc</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Forma Pgto</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-mono text-xs">
                        {expense.document_number || "-"}
                        {expense.check_number && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            CH: {expense.check_number}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {expense.suppliers?.name || "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell>
                        {expense.due_date
                          ? format(parseISO(expense.due_date), "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {expense.payment_method
                          ? paymentMethodLabels[expense.payment_method]
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[expense.effectiveStatus]}
                        >
                          {statusLabels[expense.effectiveStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(Number(expense.amount))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(expense)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {(expense.status === "pending" || expense.effectiveStatus === "overdue") && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: expense.id,
                                      status: "paid",
                                    })
                                  }
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Liquidar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: expense.id,
                                      status: "cancelled",
                                    })
                                  }
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            {expense.status !== "paid" && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(expense.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma despesa encontrada
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={(open) => {
          setExpenseDialogOpen(open);
          if (!open) setEditingExpense(null);
        }}
        clinicId={clinicId}
        expense={editingExpense}
      />

      <CheckLiquidationDialog
        open={checkLiquidationOpen}
        onOpenChange={setCheckLiquidationOpen}
        clinicId={clinicId}
      />
    </div>
  );
}
