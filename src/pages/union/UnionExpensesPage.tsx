import { useState, useMemo } from "react";
import { RefreshDataButton } from "@/components/common/RefreshDataButton";
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
import { UnionCopyExpensesDialog } from "@/components/union/financials/UnionCopyExpensesDialog";
import { UnionBatchCheckPrintDialog } from "@/components/union/financials/UnionBatchCheckPrintDialog";
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
  Copy,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
export default function UnionExpensesPage() {
  const { currentClinic, session, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const { canManageExpenses } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [checkPrintDialogOpen, setCheckPrintDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [batchPrintDialogOpen, setBatchPrintDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [cashRegisterFilter, setCashRegisterFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [checkNumberFilter, setCheckNumberFilter] = useState<string>("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const handleSearchByDate = () => {
    setStartDateFilter(startDateInput);
    setEndDateFilter(endDateInput);
  };

  const clinicId = resolvedClinic?.id;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["union-financial-transactions", clinicId, "expense", startDateFilter, endDateFilter],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("union_financial_transactions")
          .select(`
            *,
            category:union_financial_categories(id, name, color),
            supplier:union_suppliers(id, name, trade_name, cnpj, cpf),
            cash_register:union_cash_registers(id, name)
          `)
          .eq("clinic_id", clinicId!)
          .eq("type", "expense")
          .order("due_date", { ascending: false });

        // Apply date filters server-side
        if (startDateFilter) {
          query = query.gte("due_date", startDateFilter);
        }
        if (endDateFilter) {
          query = query.lte("due_date", endDateFilter);
        }

        query = query.range(from, from + PAGE_SIZE - 1);

        const { data, error } = await query;
        if (error) throw error;

        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allData;
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
      try {
        let effectiveStatus = t.status;
        if (t.status === "pending" && t.due_date) {
          const dueDate = startOfDay(parseISO(t.due_date));
          if (!isNaN(dueDate.getTime()) && isAfter(today, dueDate)) {
            effectiveStatus = "overdue";
          }
        }
        return { ...t, effectiveStatus };
      } catch (err) {
        console.error("[UnionExpenses] Error processing transaction:", t.id, err);
        return { ...t, effectiveStatus: t.status || "pending" };
      }
    });
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const normalize = (value: unknown) => String(value ?? "").toLowerCase();
    const searchTerm = normalize(search);
    const searchDigits = String(search ?? "").replace(/\D/g, "");

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const filtered = processedTransactions.filter((t) => {
      // Text search (resiliente a null/number/object)
      const matchesSearch =
        normalize(t.description).includes(searchTerm) ||
        normalize(t.supplier?.name).includes(searchTerm) ||
        normalize(t.supplier?.trade_name).includes(searchTerm) ||
        (searchDigits.length >= 3 &&
          (String(t.supplier?.cnpj ?? "").replace(/\D/g, "").includes(searchDigits) ||
            String(t.supplier?.cpf ?? "").replace(/\D/g, "").includes(searchDigits))) ||
        normalize(t.category?.name).includes(searchTerm) ||
        normalize(t.check_number).includes(searchTerm) ||
        normalize(t.document_number).includes(searchTerm);

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
        !checkNumberFilter || normalize(t.check_number).includes(normalize(checkNumberFilter));

      // Date range filter is now applied server-side
      const matchesDateRange = true;

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

    // Sort: current month/year first, then by due_date descending
    return filtered.sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date + "T12:00:00") : null;
      const bDate = b.due_date ? new Date(b.due_date + "T12:00:00") : null;
      const aCurrent = aDate && aDate.getFullYear() === currentYear && aDate.getMonth() === currentMonth ? 0 : 1;
      const bCurrent = bDate && bDate.getFullYear() === currentYear && bDate.getMonth() === currentMonth ? 0 : 1;
      if (aCurrent !== bCurrent) return aCurrent - bCurrent;

      // Within same group, sort by due_date descending
      const aTime = aDate?.getTime() ?? 0;
      const bTime = bDate?.getTime() ?? 0;
      return bTime - aTime;
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

  const undoPaymentMutation = useMutation({
    mutationFn: async (transaction: any) => {
      const { error } = await supabase
        .from("union_financial_transactions")
        .update({
          status: "pending",
          paid_date: null,
        })
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-flow"] });
      toast.success("Baixa desfeita! Despesa voltou ao status pendente.");
    },
    onError: (err: any) => {
      toast.error("Erro ao desfazer baixa: " + (err?.message || "Erro desconhecido"));
    },
  });

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  };

  const handleCopyTransaction = (transaction: any) => {
    // Remove id and reset status to create a new copy
    const { id, created_at, updated_at, payment_date, status, ...rest } = transaction;
    setEditingTransaction({ ...rest, status: "pending", _isCopy: true });
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
    setStartDateInput("");
    setEndDateInput("");
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
      reimbursement: "Ressarcimento",
      chargeback: "Estorno",
      compensation: "Compensação",
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
        <div className="flex items-center gap-2">
          <RefreshDataButton
            queryKeys={[["union-financial-transactions"], ["union-suppliers"], ["union-cash-registers"]]}
          />
        {canManageExpenses() && (
          <Button size="sm" onClick={() => { setEditingTransaction(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Despesa
          </Button>
        )}
        </div>
      </div>

      {/* Compact Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-muted-foreground bg-muted/30">
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

        <Card className="border-l-4 border-l-warning bg-warning/5">
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

        <Card className="border-l-4 border-l-destructive bg-destructive/5">
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

        <Card className="border-l-4 border-l-success bg-success/5">
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
            placeholder="Buscar por descrição, razão social, nome fantasia ou CNPJ..."
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
          <Button variant="outline" size="sm" className="h-9" onClick={() => setCheckPrintDialogOpen(true)}>
            <Printer className="h-4 w-4 mr-1.5" />
            Cópia Cheque
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setBatchPrintDialogOpen(true)}>
            <Printer className="h-4 w-4 mr-1.5" />
            Lote Cheques
          </Button>
          {canManageExpenses() && (
            <>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setCopyDialogOpen(true)}>
                <Copy className="h-4 w-4 mr-1.5" />
                Copiar Despesas
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
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="h-8 mt-1 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs">Data Fim</Label>
                  <Input
                    type="date"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="h-8 mt-1 text-sm"
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                  Limpar filtros
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleSearchByDate}>
                  <Search className="h-3.5 w-3.5 mr-1" />
                  Buscar
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
             <div className="col-span-2">Descrição</div>
             <div className="col-span-2">Fornecedor</div>
             <div className="col-span-1">Nº Doc</div>
             <div className="col-span-2">Categoria / Cheque</div>
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
                     <div className="col-span-2 flex items-center gap-2 min-w-0">
                       <TrendingDown className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                       <span className="font-medium truncate" title={transaction.description}>
                         {transaction.description}
                       </span>
                     </div>

                     {/* Fornecedor */}
                     <div className="col-span-2 flex items-start gap-1.5 min-w-0">
                       <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                       <div className="min-w-0">
                         <span className="text-muted-foreground truncate text-xs block" title={transaction.supplier?.name}>
                           {transaction.supplier?.name || "—"}
                         </span>
                         {(() => {
                           const doc = String(transaction.supplier?.cnpj || transaction.supplier?.cpf || "").replace(/\D/g, "");
                           if (doc.length === 14) {
                             return <span className="text-[10px] text-muted-foreground/80 font-mono block truncate">{doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>;
                           }
                           if (doc.length === 11) {
                             return <span className="text-[10px] text-muted-foreground/80 font-mono block truncate">{doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>;
                           }
                           return null;
                         })()}
                       </div>
                     </div>

                     {/* Nº Documento */}
                     <div className="col-span-1 min-w-0">
                       <span className="font-mono text-xs text-muted-foreground truncate block" title={transaction.document_number || ""}>
                         {transaction.document_number || "—"}
                       </span>
                     </div>

                     {/* Categoria / Cheque */}
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
                       {transaction.check_number && (
                         <div className="flex items-center gap-1 text-xs text-muted-foreground">
                           <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                             CH:{transaction.check_number}
                           </Badge>
                         </div>
                       )}
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
                            ? (() => { try { return format(parseISO(transaction.due_date), "dd/MM/yy", { locale: ptBR }); } catch { return transaction.due_date; } })()
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
                            <DropdownMenuItem onClick={() => handleCopyTransaction(transaction)}>
                              <Copy className="h-3.5 w-3.5 mr-2" />
                              Copiar Lançamento
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
                            {transaction.effectiveStatus === "paid" && (
                              <DropdownMenuItem onClick={() => undoPaymentMutation.mutate(transaction)}>
                                <Undo2 className="h-3.5 w-3.5 mr-2" />
                                Desfazer Baixa
                              </DropdownMenuItem>
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

      <UnionCopyExpensesDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        clinicId={clinicId}
      />

      <UnionBatchCheckPrintDialog
        open={batchPrintDialogOpen}
        onOpenChange={setBatchPrintDialogOpen}
        clinicId={clinicId}
      />
    </div>
  );
}
