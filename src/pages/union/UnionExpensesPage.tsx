import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { UnionTransactionDialog } from "@/components/union/financials/UnionTransactionDialog";
import { UnionCheckLiquidationDialog } from "@/components/union/financials/UnionCheckLiquidationDialog";
import { UnionCheckPrintDialog } from "@/components/union/financials/UnionCheckPrintDialog";
import { toast } from "sonner";
import { format, parseISO, startOfDay, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  TrendingDown,
  MoreHorizontal,
  Edit,
  Trash2,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  ChevronDown,
  FileCheck,
  XCircle,
  CreditCard,
  FileText,
  Printer,
} from "lucide-react";

export default function UnionExpensesPage() {
  const { currentClinic, session } = useAuth();
  const { canManageExpenses } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [checkPrintDialogOpen, setCheckPrintDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [cashRegisterFilter, setCashRegisterFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [checkNumberFilter, setCheckNumberFilter] = useState<string>("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const clinicId = currentClinic?.id;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["union-financial-transactions", clinicId, "expense"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_transactions")
        .select(`
          *,
          category:union_financial_categories(id, name, color),
          supplier:union_suppliers(id, name),
          cash_register:union_cash_registers(id, name)
        `)
        .eq("clinic_id", clinicId!)
        .eq("type", "expense")
        .order("due_date", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Fetch suppliers for filter
  const { data: suppliers } = useQuery({
    queryKey: ["union-suppliers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_suppliers")
        .select("id, name")
        .eq("clinic_id", clinicId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Fetch cash registers for filter
  const { data: cashRegisters } = useQuery({
    queryKey: ["union-cash-registers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_cash_registers")
        .select("id, name")
        .eq("clinic_id", clinicId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Process transactions to detect overdue
  const processedTransactions = useMemo(() => {
    if (!transactions) return [];
    const today = startOfDay(new Date());
    return transactions.map((t) => {
      let effectiveStatus = t.status;
      if (t.status === "pending" && t.due_date) {
        const dueDate = startOfDay(parseISO(t.due_date));
        if (isAfter(today, dueDate)) {
          effectiveStatus = "overdue";
        }
      }
      return { ...t, effectiveStatus };
    });
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter((t) => {
      // Text search
      const matchesSearch =
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.category?.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.check_number?.toLowerCase().includes(search.toLowerCase()) ||
        t.document_number?.toLowerCase().includes(search.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || t.effectiveStatus === statusFilter;

      // Supplier filter
      const matchesSupplier =
        supplierFilter === "all" || t.supplier_id === supplierFilter;

      // Cash register filter
      const matchesCashRegister =
        cashRegisterFilter === "all" || t.cash_register_id === cashRegisterFilter;

      // Payment method filter
      const matchesPaymentMethod =
        paymentMethodFilter === "all" || t.payment_method === paymentMethodFilter;

      // Check number filter
      const matchesCheckNumber =
        !checkNumberFilter || 
        (t.check_number && t.check_number.toLowerCase().includes(checkNumberFilter.toLowerCase()));

      // Date range filter
      let matchesDateRange = true;
      if (startDateFilter && t.due_date) {
        matchesDateRange = t.due_date >= startDateFilter;
      }
      if (endDateFilter && t.due_date) {
        matchesDateRange = matchesDateRange && t.due_date <= endDateFilter;
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSupplier &&
        matchesCashRegister &&
        matchesPaymentMethod &&
        matchesCheckNumber &&
        matchesDateRange
      );
    });
  }, [
    processedTransactions,
    search,
    statusFilter,
    supplierFilter,
    cashRegisterFilter,
    paymentMethodFilter,
    checkNumberFilter,
    startDateFilter,
    endDateFilter,
  ]);

  const deleteMutation = useMutation({
    mutationFn: async (transaction: any) => {
      if (transaction.status === "paid") {
        throw new Error("Não é possível excluir despesas já pagas. Use o estorno.");
      }
      const { error } = await supabase
        .from("union_financial_transactions")
        .delete()
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      toast.success("Despesa excluída!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao excluir despesa");
    },
  });

  const liquidateMutation = useMutation({
    mutationFn: async (transaction: any) => {
      const { error } = await supabase
        .from("union_financial_transactions")
        .update({
          status: "paid",
          paid_date: format(new Date(), "yyyy-MM-dd"),
          liquidated_by: session?.user?.id,
        })
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      toast.success("Despesa liquidada!");
    },
    onError: () => {
      toast.error("Erro ao liquidar despesa");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (transaction: any) => {
      const { error } = await supabase
        .from("union_financial_transactions")
        .update({ status: "cancelled" })
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      toast.success("Despesa cancelada!");
    },
    onError: () => {
      toast.error("Erro ao cancelar despesa");
    },
  });

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const clearFilters = () => {
    setStatusFilter("all");
    setSupplierFilter("all");
    setCashRegisterFilter("all");
    setPaymentMethodFilter("all");
    setCheckNumberFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
  };

  // Summary calculations
  const totalExpenses = processedTransactions.reduce(
    (sum, t) => sum + Number(t.net_value || t.amount),
    0
  );
  const pendingExpenses = processedTransactions
    .filter((t) => t.effectiveStatus === "pending")
    .reduce((sum, t) => sum + Number(t.net_value || t.amount), 0);
  const overdueExpenses = processedTransactions
    .filter((t) => t.effectiveStatus === "overdue")
    .reduce((sum, t) => sum + Number(t.net_value || t.amount), 0);
  const paidExpenses = processedTransactions
    .filter((t) => t.effectiveStatus === "paid")
    .reduce((sum, t) => sum + Number(t.net_value || t.amount), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-100 text-emerald-800">Pago</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800">Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-rose-100 text-rose-800">Vencido</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-100 text-slate-800">Cancelado</Badge>;
      case "reversed":
        return <Badge className="bg-purple-100 text-purple-800">Estornado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      pix: "PIX",
      cash: "Dinheiro",
      bank_transfer: "Transferência",
      credit_card: "Cartão Crédito",
      debit_card: "Cartão Débito",
      check: "Cheque",
      boleto: "Boleto",
    };
    return methods[method] || method;
  };

  if (!clinicId) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Despesas</h1>
        <p className="text-muted-foreground">
          Gerencie as despesas do módulo sindical
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-rose-500" />
              Total de Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-muted-foreground">
              {processedTransactions.length} lançamento(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(pendingExpenses)}</p>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              Vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-600">{formatCurrency(overdueExpenses)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Pagas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(paidExpenses)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, fornecedor, cheque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={filtersOpen ? "bg-accent" : ""}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </Button>
          {canManageExpenses() && (
            <>
              <Button variant="outline" onClick={() => setCheckPrintDialogOpen(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Cópia de Cheque
              </Button>
              <Button variant="outline" onClick={() => setCheckDialogOpen(true)}>
                <FileCheck className="h-4 w-4 mr-2" />
                Liquidar por Cheque
              </Button>
              <Button
                onClick={() => {
                  setEditingTransaction(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Despesa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fornecedor</Label>
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger className="mt-1">
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
                  <Label>Portador</Label>
                  <Select value={cashRegisterFilter} onValueChange={setCashRegisterFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {cashRegisters?.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>
                          {cr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="bank_transfer">Transferência</SelectItem>
                      <SelectItem value="check">Cheque</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="credit_card">Cartão Crédito</SelectItem>
                      <SelectItem value="debit_card">Cartão Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Nº Cheque</Label>
                  <Input
                    placeholder="Ex: 1258"
                    value={checkNumberFilter}
                    onChange={(e) => setCheckNumberFilter(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            {filteredTransactions && filteredTransactions.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-rose-500" />
                          <span className="font-medium">{transaction.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>{transaction.supplier?.name || "-"}</TableCell>
                      <TableCell>
                        {transaction.category ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: transaction.category.color || "#6b7280" }}
                            />
                            <span>{transaction.category.name}</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {transaction.document_number && (
                            <>
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{transaction.document_number}</span>
                            </>
                          )}
                          {transaction.check_number && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              CH: {transaction.check_number}
                            </Badge>
                          )}
                          {!transaction.document_number && !transaction.check_number && "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {getPaymentMethodLabel(transaction.payment_method)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {transaction.due_date
                          ? format(parseISO(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="font-semibold text-rose-600">
                        {formatCurrency(Number(transaction.net_value || transaction.amount))}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.effectiveStatus)}</TableCell>
                      <TableCell>
                        {canManageExpenses() && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(transaction)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {(transaction.effectiveStatus === "pending" ||
                                transaction.effectiveStatus === "overdue") && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => liquidateMutation.mutate(transaction)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Liquidar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => cancelMutation.mutate(transaction)}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancelar
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(transaction)}
                                disabled={transaction.status === "paid"}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma despesa encontrada</p>
                <p className="text-sm">Clique em "Nova Despesa" para começar.</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <UnionTransactionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTransaction(null);
        }}
        transaction={editingTransaction}
        clinicId={clinicId}
        defaultType="expense"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
        }}
      />

      <UnionCheckLiquidationDialog
        open={checkDialogOpen}
        onOpenChange={setCheckDialogOpen}
        clinicId={clinicId}
      />

      <UnionCheckPrintDialog
        open={checkPrintDialogOpen}
        onOpenChange={setCheckPrintDialogOpen}
        clinicId={clinicId}
      />
    </div>
  );
}
