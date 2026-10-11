import { useState, useMemo, useEffect } from "react";
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
import { format, parseISO, startOfDay, isAfter, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KpiCard, CountTabs, StatusBadge } from "@/components/design-system";
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
  Wallet,
  MoreVertical,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
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
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
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
  const filteredTransactionsNoStatus = useMemo(() => {
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

      const matchesStatus = true;
      const matchesCategory = categoryFilter === "all" || t.category_id === categoryFilter || t.category?.id === categoryFilter;

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
        matchesCategory &&
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
    categoryFilter,
    supplierFilter,
    cashRegisterFilter,
    paymentMethodFilter,
    checkNumberFilter,
    startDateFilter,
    endDateFilter,
  ]);

  const filteredTransactions = useMemo(
    () => (statusFilter === "all" ? filteredTransactionsNoStatus : filteredTransactionsNoStatus.filter((t) => t.effectiveStatus === statusFilter)),
    [filteredTransactionsNoStatus, statusFilter]
  );

  useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter, supplierFilter, cashRegisterFilter, paymentMethodFilter, checkNumberFilter, startDateFilter, endDateFilter]);

  const categoryOptions = useMemo(() => {
    const m = new Map<string, string>();
    processedTransactions.forEach((t) => { if (t.category?.id) m.set(t.category.id, t.category.name); });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [processedTransactions]);

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
    setCategoryFilter("all");
    setCheckNumberFilter("");
    setStartDateInput("");
    setEndDateInput("");
    setStartDateFilter("");
    setEndDateFilter("");
    setSearch("");
  };

  const applyPeriod = (start: string, end: string) => {
    setStartDateInput(start); setEndDateInput(end);
    setStartDateFilter(start); setEndDateFilter(end);
    setPeriodOpen(false);
  };
  const periodLabel = (() => {
    if (!startDateFilter && !endDateFilter) return "Todo o período";
    const f = (d: string) => { try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; } };
    if (startDateFilter && endDateFilter) {
      const s = parseISO(startDateFilter), e = parseISO(endDateFilter);
      if (s.getDate() === 1 && e.getMonth() === s.getMonth() && e.getFullYear() === s.getFullYear() && endOfMonth(s).getDate() === e.getDate()) {
        const l = format(s, "MMMM 'de' yyyy", { locale: ptBR });
        return l.charAt(0).toUpperCase() + l.slice(1);
      }
      return `${f(startDateFilter)} – ${f(endDateFilter)}`;
    }
    return startDateFilter ? `A partir de ${f(startDateFilter)}` : `Até ${f(endDateFilter)}`;
  })();

  const amountOf = (t: any) => Number(t.net_value || t.amount);
  // Indicadores e abas respeitam os filtros (exceto a própria situação)
  const baseFiltered = useMemo(
    () => filteredTransactionsNoStatus,
    [filteredTransactionsNoStatus]
  );
  const sumBy = (st?: string) => baseFiltered.filter((t) => !st || t.effectiveStatus === st).reduce((s, t) => s + amountOf(t), 0);
  const countBy = (st?: string) => (st ? baseFiltered.filter((t) => t.effectiveStatus === st).length : baseFiltered.length);
  const totalExpenses = sumBy();
  const pendingExpenses = sumBy("pending");
  const overdueExpenses = sumBy("overdue");
  const paidExpenses = sumBy("paid");
  const pendingCount = countBy("pending");
  const overdueCount = countBy("overdue");
  const paidCount = countBy("paid");
  const cancelledCount = countBy("cancelled");

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusTone: Record<string, "success" | "warning" | "destructive" | "default" | "primary"> = {
    paid: "success", pending: "warning", overdue: "destructive", cancelled: "default", reversed: "primary",
  };
  const statusLabel: Record<string, string> = { paid: "Paga", pending: "Pendente", overdue: "Vencida", cancelled: "Cancelada", reversed: "Estornada" };
  const getStatusBadge = (status: string) => <StatusBadge tone={statusTone[status] ?? "default"}>{statusLabel[status] ?? status}</StatusBadge>;

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      pix: "PIX", cash: "Dinheiro", bank_transfer: "Transferência", credit_card: "Cartão Crédito", debit_card: "Cartão Débito",
      check: "Cheque", boleto: "Boleto", reimbursement: "Ressarcimento", chargeback: "Estorno", compensation: "Compensação",
    };
    return methods[method] || method;
  };

  const formatDoc = (raw: unknown) => {
    const doc = String(raw || "").replace(/\D/g, "");
    if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return "";
  };

  if (!clinicId) return null;

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const today = new Date();
  const ym = (d: Date) => format(d, "yyyy-MM-dd");
  const activeExtraFilters = [paymentMethodFilter !== "all", !!checkNumberFilter].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><Wallet className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Despesas</h1>
            <p className="text-sm text-muted-foreground">Cadastre, acompanhe e gerencie as despesas do sindicato.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2"><Calendar className="h-4 w-4" />{periodLabel}<ChevronDown className="h-3.5 w-3.5 opacity-60" /></Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => applyPeriod(ym(startOfMonth(today)), ym(endOfMonth(today)))}>Este mês</Button>
                <Button variant="secondary" size="sm" onClick={() => { const p = subMonths(today, 1); applyPeriod(ym(startOfMonth(p)), ym(endOfMonth(p))); }}>Mês anterior</Button>
                <Button variant="secondary" size="sm" onClick={() => applyPeriod(`${today.getFullYear()}-01-01`, `${today.getFullYear()}-12-31`)}>Este ano</Button>
                <Button variant="secondary" size="sm" onClick={() => applyPeriod("", "")}>Todo o período</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">De</Label><Input type="date" value={startDateInput} onChange={(e) => setStartDateInput(e.target.value)} className="mt-1 h-8 text-sm" /></div>
                <div><Label className="text-xs">Até</Label><Input type="date" value={endDateInput} onChange={(e) => setEndDateInput(e.target.value)} className="mt-1 h-8 text-sm" /></div>
              </div>
              <Button size="sm" className="w-full" onClick={() => applyPeriod(startDateInput, endDateInput)}>Aplicar período</Button>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2"><MoreHorizontal className="h-4 w-4" />Mais ações<ChevronDown className="h-3.5 w-3.5 opacity-60" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setCheckPrintDialogOpen(true)}><Printer className="h-4 w-4 mr-2" />Cópia de cheque</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBatchPrintDialogOpen(true)}><Printer className="h-4 w-4 mr-2" />Lote de cheques</DropdownMenuItem>
              {canManageExpenses() && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCopyDialogOpen(true)}><Copy className="h-4 w-4 mr-2" />Copiar despesas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCheckDialogOpen(true)}><FileCheck className="h-4 w-4 mr-2" />Liquidar cheque</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { ["union-financial-transactions", "union-suppliers", "union-cash-registers"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })); toast.success("Dados atualizados"); }}>
                <RefreshCw className="h-4 w-4 mr-2" />Atualizar dados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManageExpenses() && (
            <Button size="sm" className="h-9" onClick={() => { setEditingTransaction(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nova Despesa
            </Button>
          )}
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total de despesas" value={formatCurrency(totalExpenses)} hint={`${countBy().toLocaleString("pt-BR")} lançamentos`} icon={Wallet} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <KpiCard label="Pendentes" tone="warning" value={formatCurrency(pendingExpenses)} hint={`${pendingCount.toLocaleString("pt-BR")} despesas`} icon={Clock} active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} />
        <KpiCard label="Vencidas" tone="destructive" value={formatCurrency(overdueExpenses)} hint={`${overdueCount.toLocaleString("pt-BR")} despesas`} icon={AlertCircle} active={statusFilter === "overdue"} onClick={() => setStatusFilter("overdue")} />
        <KpiCard label="Pagas" tone="success" value={formatCurrency(paidExpenses)} hint={`${paidCount.toLocaleString("pt-BR")} despesas`} icon={CheckCircle} active={statusFilter === "paid"} onClick={() => setStatusFilter("paid")} />
      </div>

      {/* Abas + filtros + tabela */}
      <div className="rounded-xl border bg-card shadow-sm">
        <CountTabs
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          items={[
            { value: "all", label: "Todas", count: countBy(), tone: "primary" },
            { value: "pending", label: "Pendentes", count: pendingCount, tone: "warning" },
            { value: "overdue", label: "Vencidas", count: overdueCount, tone: "destructive" },
            { value: "paid", label: "Pagas", count: paidCount, tone: "success" },
            ...(cancelledCount > 0 ? [{ value: "cancelled", label: "Canceladas", count: cancelledCount }] : []),
          ]}
        />

        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por descrição, fornecedor, CNPJ ou nº do documento..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue placeholder="Categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categoryOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os fornecedores</SelectItem>
                {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cashRegisterFilter} onValueChange={setCashRegisterFilter}>
              <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue placeholder="Conta bancária" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {cashRegisters?.map((cr) => <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5"><Filter className="h-4 w-4" />Mais filtros{activeExtraFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeExtraFilters}</span>}</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <div>
                  <Label className="text-xs">Forma de pagamento</Label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="bank_transfer">Transferência</SelectItem>
                      <SelectItem value="check">Cheque</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nº do cheque</Label>
                  <Input placeholder="Ex: 1258" value={checkNumberFilter} onChange={(e) => setCheckNumberFilter(e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="link" size="sm" className="h-9 px-2" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-3 py-2.5 font-medium">Fornecedor</th>
                <th className="px-3 py-2.5 font-medium">Nº Doc</th>
                <th className="px-3 py-2.5 font-medium">Categoria</th>
                <th className="px-3 py-2.5 font-medium">Vencimento</th>
                <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.length > 0 ? pageRows.map((transaction) => (
                <tr key={transaction.id} className="transition-colors hover:bg-muted/40">
                  <td className="max-w-[260px] px-4 py-2.5">
                    <p className="truncate font-medium text-foreground" title={transaction.description}>{transaction.description}</p>
                    <p className="truncate text-xs text-muted-foreground">{getPaymentMethodLabel(transaction.payment_method)}{transaction.check_number ? ` · Cheque ${transaction.check_number}` : ""}</p>
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5">
                    <p className="truncate text-foreground" title={transaction.supplier?.name}>{transaction.supplier?.name || "—"}</p>
                    {formatDoc(transaction.supplier?.cnpj || transaction.supplier?.cpf) && <p className="truncate font-mono text-[11px] text-muted-foreground">{formatDoc(transaction.supplier?.cnpj || transaction.supplier?.cpf)}</p>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{transaction.document_number || "—"}</td>
                  <td className="max-w-[180px] px-3 py-2.5">
                    {transaction.category ? (
                      <span className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: transaction.category.color || "hsl(var(--muted-foreground))" }} /><span className="truncate text-xs">{transaction.category.name}</span></span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className={cn("whitespace-nowrap px-3 py-2.5 text-xs", transaction.effectiveStatus === "overdue" ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {transaction.due_date ? (() => { try { return format(parseISO(transaction.due_date), "dd/MM/yyyy", { locale: ptBR }); } catch { return transaction.due_date; } })() : "—"}
                  </td>
                  <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums", transaction.effectiveStatus === "paid" ? "text-success" : "text-destructive")}>
                    {formatCurrency(amountOf(transaction))}
                  </td>
                  <td className="px-3 py-2.5">{getStatusBadge(transaction.effectiveStatus)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canManageExpenses() && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => handleEdit(transaction)}><Edit className="h-3.5 w-3.5 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyTransaction(transaction)}><Copy className="h-3.5 w-3.5 mr-2" />Copiar lançamento</DropdownMenuItem>
                          {(transaction.effectiveStatus === "pending" || transaction.effectiveStatus === "overdue") && (
                            <>
                              <DropdownMenuItem onClick={() => liquidateMutation.mutate(transaction)}><CheckCircle className="h-3.5 w-3.5 mr-2" />Liquidar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => cancelMutation.mutate(transaction)}><XCircle className="h-3.5 w-3.5 mr-2" />Cancelar</DropdownMenuItem>
                            </>
                          )}
                          {transaction.effectiveStatus === "paid" && (
                            <DropdownMenuItem onClick={() => undoPaymentMutation.mutate(transaction)}><Undo2 className="h-3.5 w-3.5 mr-2" />Desfazer baixa</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(transaction)} disabled={transaction.status === "paid"}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="py-14 text-center text-muted-foreground">
                  <TrendingDown className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p className="font-medium">Nenhuma despesa encontrada</p>
                  <p className="text-sm">Ajuste os filtros ou clique em "Nova Despesa".</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {filteredTransactions.length === 0 ? "Nenhum registro" : `Mostrando ${((currentPage - 1) * pageSize + 1).toLocaleString("pt-BR")} a ${Math.min(currentPage * pageSize, filteredTransactions.length).toLocaleString("pt-BR")} de ${filteredTransactions.length.toLocaleString("pt-BR")} registros`}
          </span>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[120px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{[15, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[70px] text-center tabular-nums">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

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
