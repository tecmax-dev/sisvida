import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Calendar,
  Building2,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const pendingCount = processedTransactions.filter((t) => t.effectiveStatus === "pending").length;
  const overdueCount = processedTransactions.filter((t) => t.effectiveStatus === "overdue").length;
  const paidCount = processedTransactions.filter((t) => t.effectiveStatus === "paid").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs px-2 py-0.5">Pago</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-xs px-2 py-0.5">Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 text-xs px-2 py-0.5">Vencido</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 text-xs px-2 py-0.5">Cancelado</Badge>;
      case "reversed":
        return <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 text-xs px-2 py-0.5">Estornado</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0.5">{status}</Badge>;
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
      <div className="space-y-4 p-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Despesas</h1>
          <p className="text-sm text-muted-foreground">
            {filteredTransactions.length} de {processedTransactions.length} registros
          </p>
        </div>
        {canManageExpenses() && (
          <Button size="sm" onClick={() => { setEditingTransaction(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Despesa
          </Button>
        )}
      </div>

      {/* Compact Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-slate-400 dark:border-l-slate-500 bg-gradient-to-r from-slate-50/80 dark:from-slate-900/50 to-transparent">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totalExpenses)}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{processedTransactions.length} lançamentos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-400 dark:border-l-amber-500 bg-gradient-to-r from-amber-50/80 dark:from-amber-950/30 to-transparent">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Pendentes</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(pendingExpenses)}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{pendingCount} despesas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-400 dark:border-l-rose-500 bg-gradient-to-r from-rose-50/80 dark:from-rose-950/30 to-transparent">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wide">Vencidas</p>
                <p className="text-lg font-bold text-rose-700 dark:text-rose-300">{formatCurrency(overdueExpenses)}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-rose-500 dark:text-rose-400" />
              </div>
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-500 mt-1">{overdueCount} despesas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-400 dark:border-l-emerald-500 bg-gradient-to-r from-emerald-50/80 dark:from-emerald-950/30 to-transparent">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Pagas</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(paidExpenses)}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">{paidCount} despesas</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar despesas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn("h-9", filtersOpen && "bg-accent")}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filtros
            <ChevronDown className={cn("h-3.5 w-3.5 ml-1 transition-transform", filtersOpen && "rotate-180")} />
          </Button>
          {canManageExpenses() && (
            <>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setCheckPrintDialogOpen(true)}>
                <Printer className="h-4 w-4 mr-1.5" />
                Cópia Cheque
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setCheckDialogOpen(true)}>
                <FileCheck className="h-4 w-4 mr-1.5" />
                Liquidar Cheque
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <Card className="bg-muted/30">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 mt-1 text-sm">
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
                  <Label className="text-xs">Fornecedor</Label>
                  <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                    <SelectTrigger className="h-8 mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {suppliers?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Portador</Label>
                  <Select value={cashRegisterFilter} onValueChange={setCashRegisterFilter}>
                    <SelectTrigger className="h-8 mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {cashRegisters?.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Pagamento</Label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger className="h-8 mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="bank_transfer">Transferência</SelectItem>
                      <SelectItem value="check">Cheque</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Nº Cheque</Label>
                  <Input
                    placeholder="Ex: 1258"
                    value={checkNumberFilter}
                    onChange={(e) => setCheckNumberFilter(e.target.value)}
                    className="h-8 mt-1 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs">Data Início</Label>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="h-8 mt-1 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="h-8 mt-1 text-sm"
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Expense List - Compact Professional Design */}
      <Card>
        <CardContent className="p-0">
          {/* Fixed Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <div className="col-span-3">Descrição</div>
            <div className="col-span-2">Fornecedor</div>
            <div className="col-span-2">Categoria / Doc</div>
            <div className="col-span-1 text-center">Vencimento</div>
            <div className="col-span-2 text-right">Valor</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1"></div>
          </div>

          <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px]">
            {filteredTransactions && filteredTransactions.length > 0 ? (
              <div className="divide-y divide-border/50">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={cn(
                      "grid grid-cols-12 gap-2 px-3 py-2 hover:bg-muted/30 transition-colors items-center text-sm",
                      transaction.effectiveStatus === "overdue" && "bg-rose-50/30 dark:bg-rose-950/20"
                    )}
                  >
                    {/* Descrição */}
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      <TrendingDown className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                      <span className="font-medium truncate" title={transaction.description}>
                        {transaction.description}
                      </span>
                    </div>

                    {/* Fornecedor */}
                    <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                      <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground truncate text-xs" title={transaction.supplier?.name}>
                        {transaction.supplier?.name || "—"}
                      </span>
                    </div>

                    {/* Categoria / Documento */}
                    <div className="col-span-2 space-y-0.5 min-w-0">
                      {transaction.category && (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: transaction.category.color || "#6b7280" }}
                          />
                          <span className="text-xs truncate">{transaction.category.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {transaction.check_number && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            CH:{transaction.check_number}
                          </Badge>
                        )}
                        {transaction.document_number && !transaction.check_number && (
                          <span className="truncate flex items-center gap-0.5">
                            <FileText className="h-2.5 w-2.5" />
                            {transaction.document_number}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vencimento */}
                    <div className="col-span-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className={cn(
                          "text-xs",
                          transaction.effectiveStatus === "overdue" && "text-rose-600 dark:text-rose-400 font-medium"
                        )}>
                          {transaction.due_date
                            ? format(parseISO(transaction.due_date), "dd/MM/yy", { locale: ptBR })
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Valor */}
                    <div className="col-span-2 text-right">
                      <span className={cn(
                        "font-semibold",
                        transaction.effectiveStatus === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {formatCurrency(Number(transaction.net_value || transaction.amount))}
                      </span>
                      <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                        <CreditCard className="h-2.5 w-2.5" />
                        {getPaymentMethodLabel(transaction.payment_method)}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-1 flex justify-center">
                      {getStatusBadge(transaction.effectiveStatus)}
                    </div>

                    {/* Ações */}
                    <div className="col-span-1 flex justify-end">
                      {canManageExpenses() && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleEdit(transaction)}>
                              <Edit className="h-3.5 w-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {(transaction.effectiveStatus === "pending" ||
                              transaction.effectiveStatus === "overdue") && (
                              <>
                                <DropdownMenuItem onClick={() => liquidateMutation.mutate(transaction)}>
                                  <CheckCircle className="h-3.5 w-3.5 mr-2" />
                                  Liquidar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => cancelMutation.mutate(transaction)}>
                                  <XCircle className="h-3.5 w-3.5 mr-2" />
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
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhuma despesa encontrada</p>
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
