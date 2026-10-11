import { useState, useMemo, useEffect } from "react";
import { RefreshDataButton } from "@/components/common/RefreshDataButton";
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
import { toast } from "sonner";
import { format, parseISO, startOfDay, isAfter, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KpiCard, CountTabs, StatusBadge } from "@/components/design-system";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ptBR } from "date-fns/locale";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import {
  Plus,
  Search,
  TrendingUp,
  MoreHorizontal,
  Edit,
  Trash2,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  ChevronDown,
  XCircle,
  CreditCard,
  Calendar,
  MoreVertical,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function UnionIncomePage() {
  const { currentClinic, session, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const { canManageIncome } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteConfirmTransaction, setDeleteConfirmTransaction] = useState<any>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cashRegisterFilter, setCashRegisterFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const clinicId = resolvedClinic?.id;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["union-financial-transactions", clinicId, "income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_transactions")
        .select(`
          *,
          category:union_financial_categories(id, name, color),
          cash_register:union_cash_registers(id, name)
        `)
        .eq("clinic_id", clinicId!)
        .eq("type", "income")
        .order("due_date", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ["union-financial-categories", clinicId, "income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_categories")
        .select("id, name, color")
        .eq("clinic_id", clinicId!)
        .eq("type", "income")
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
  const filteredTransactionsNoStatus = useMemo(() => {
    return processedTransactions.filter((t) => {
      // Text search
      const matchesSearch =
        String(t.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        t.category?.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.document_number?.toLowerCase().includes(search.toLowerCase());

      // Status filter
      const matchesStatus = true;

      // Category filter
      const matchesCategory =
        categoryFilter === "all" || t.category_id === categoryFilter;

      // Cash register filter
      const matchesCashRegister =
        cashRegisterFilter === "all" || t.cash_register_id === cashRegisterFilter;

      // Payment method filter
      const matchesPaymentMethod =
        paymentMethodFilter === "all" || t.payment_method === paymentMethodFilter;

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
        matchesCategory &&
        matchesCashRegister &&
        matchesPaymentMethod &&
        matchesDateRange
      );
    });
  }, [
    processedTransactions,
    search,
    categoryFilter,
    cashRegisterFilter,
    paymentMethodFilter,
    startDateFilter,
    endDateFilter,
  ]);

  const filteredTransactions = useMemo(
    () => (statusFilter === "all" ? filteredTransactionsNoStatus : filteredTransactionsNoStatus.filter((t) => t.effectiveStatus === statusFilter)),
    [filteredTransactionsNoStatus, statusFilter]
  );

  useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter, cashRegisterFilter, paymentMethodFilter, startDateFilter, endDateFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (transaction: any) => {
      // If paid, reverse the balance effect first
      if (transaction.status === "paid" && transaction.cash_register_id) {
        const { data: register } = await supabase
          .from("union_cash_registers")
          .select("current_balance")
          .eq("id", transaction.cash_register_id)
          .single();

        if (register) {
          const amount = Number(transaction.net_value || transaction.amount);
          await supabase
            .from("union_cash_registers")
            .update({ current_balance: register.current_balance - amount })
            .eq("id", transaction.cash_register_id);
        }
      }

      // Bypass trigger: change status to cancelled first if paid
      if (transaction.status === "paid") {
        await supabase
          .from("union_financial_transactions")
          .update({ status: "cancelled" })
          .eq("id", transaction.id);
      }

      const { error } = await supabase
        .from("union_financial_transactions")
        .delete()
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      setDeleteConfirmTransaction(null);
      toast.success("Receita excluída!");
    },
    onError: (error: Error) => {
      setDeleteConfirmTransaction(null);
      toast.error(error.message || "Erro ao excluir receita");
    },
  });

  const receiveMutation = useMutation({
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
      toast.success("Receita recebida!");
    },
    onError: () => {
      toast.error("Erro ao receber receita");
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
      toast.success("Receita cancelada!");
    },
    onError: () => {
      toast.error("Erro ao cancelar receita");
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
    setCategoryFilter("all");
    setCashRegisterFilter("all");
    setPaymentMethodFilter("all");
    setStartDateFilter("");
    setEndDateFilter("");
    setStartDateInput("");
    setEndDateInput("");
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
  const sumBy = (st?: string) => filteredTransactionsNoStatus.filter((t) => !st || t.effectiveStatus === st).reduce((s, t) => s + amountOf(t), 0);
  const countBy = (st?: string) => (st ? filteredTransactionsNoStatus.filter((t) => t.effectiveStatus === st).length : filteredTransactionsNoStatus.length);
  const cancelledCount = countBy("cancelled");

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusTone: Record<string, "success" | "warning" | "destructive" | "default" | "primary"> = {
    paid: "success", pending: "warning", overdue: "destructive", cancelled: "default", reversed: "primary",
  };
  const statusLabel: Record<string, string> = { paid: "Recebida", pending: "A receber", overdue: "Vencida", cancelled: "Cancelada", reversed: "Estornada" };
  const getStatusBadge = (status: string) => <StatusBadge tone={statusTone[status] ?? "default"}>{statusLabel[status] ?? status}</StatusBadge>;

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      pix: "PIX", cash: "Dinheiro", bank_transfer: "Transferência", credit_card: "Cartão Crédito", debit_card: "Cartão Débito",
      check: "Cheque", boleto: "Boleto", reimbursement: "Ressarcimento", chargeback: "Estorno", compensation: "Compensação",
    };
    return methods[method] || method;
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
  const ymd = (d: Date) => format(d, "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success"><TrendingUp className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Receitas</h1>
            <p className="text-sm text-muted-foreground">Cadastre, acompanhe e receba as receitas do sindicato.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2"><Calendar className="h-4 w-4" />{periodLabel}<ChevronDown className="h-3.5 w-3.5 opacity-60" /></Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => applyPeriod(ymd(startOfMonth(today)), ymd(endOfMonth(today)))}>Este mês</Button>
                <Button variant="secondary" size="sm" onClick={() => { const p = subMonths(today, 1); applyPeriod(ymd(startOfMonth(p)), ymd(endOfMonth(p))); }}>Mês anterior</Button>
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
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => { ["union-financial-transactions", "union-financial-categories", "union-cash-registers"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })); toast.success("Dados atualizados"); }}>
                <RefreshCw className="h-4 w-4 mr-2" />Atualizar dados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManageIncome() && (
            <Button size="sm" className="h-9" onClick={() => { setEditingTransaction(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nova Receita
            </Button>
          )}
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total de receitas" value={formatCurrency(sumBy())} hint={`${countBy().toLocaleString("pt-BR")} lançamentos`} icon={TrendingUp} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <KpiCard label="A receber" tone="warning" value={formatCurrency(sumBy("pending"))} hint={`${countBy("pending").toLocaleString("pt-BR")} receitas`} icon={Clock} active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} />
        <KpiCard label="Vencidas" tone="destructive" value={formatCurrency(sumBy("overdue"))} hint={`${countBy("overdue").toLocaleString("pt-BR")} receitas`} icon={AlertCircle} active={statusFilter === "overdue"} onClick={() => setStatusFilter("overdue")} />
        <KpiCard label="Recebidas" tone="success" value={formatCurrency(sumBy("paid"))} hint={`${countBy("paid").toLocaleString("pt-BR")} receitas`} icon={CheckCircle} active={statusFilter === "paid"} onClick={() => setStatusFilter("paid")} />
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <CountTabs
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          items={[
            { value: "all", label: "Todas", count: countBy(), tone: "primary" },
            { value: "pending", label: "A receber", count: countBy("pending"), tone: "warning" },
            { value: "overdue", label: "Vencidas", count: countBy("overdue"), tone: "destructive" },
            { value: "paid", label: "Recebidas", count: countBy("paid"), tone: "success" },
            ...(cancelledCount > 0 ? [{ value: "cancelled", label: "Canceladas", count: cancelledCount }] : []),
          ]}
        />

        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por descrição, categoria ou nº do documento..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue placeholder="Categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color || "hsl(var(--muted-foreground))" }} />{c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cashRegisterFilter} onValueChange={setCashRegisterFilter}>
              <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue placeholder="Conta bancária" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {cashRegisters?.map((cr) => <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
              <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue placeholder="Pagamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as formas</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="bank_transfer">Transferência</SelectItem>
                <SelectItem value="check">Cheque</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="credit_card">Cartão Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão Débito</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="link" size="sm" className="h-9 px-2" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-card">
              <tr className="border-b text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Descrição</th>
                <th className="px-3 py-2.5 font-medium">Categoria</th>
                <th className="px-3 py-2.5 font-medium">Conta</th>
                <th className="px-3 py-2.5 font-medium">Vencimento</th>
                <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.length > 0 ? pageRows.map((transaction) => (
                <tr key={transaction.id} className="transition-colors hover:bg-muted/40">
                  <td className="max-w-[300px] px-4 py-2.5">
                    <p className="truncate font-medium text-foreground" title={transaction.description}>{transaction.description}</p>
                    <p className="truncate text-xs text-muted-foreground">{getPaymentMethodLabel(transaction.payment_method)}{transaction.document_number ? ` · Doc ${transaction.document_number}` : ""}</p>
                  </td>
                  <td className="max-w-[200px] px-3 py-2.5">
                    {transaction.category ? (
                      <span className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: transaction.category.color || "hsl(var(--muted-foreground))" }} /><span className="truncate text-xs">{transaction.category.name}</span></span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{transaction.cash_register?.name || "—"}</td>
                  <td className={cn("whitespace-nowrap px-3 py-2.5 text-xs", transaction.effectiveStatus === "overdue" ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {transaction.due_date ? format(parseISO(transaction.due_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-success">{formatCurrency(amountOf(transaction))}</td>
                  <td className="px-3 py-2.5">{getStatusBadge(transaction.effectiveStatus)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canManageIncome() && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEdit(transaction)}><Edit className="h-3.5 w-3.5 mr-2" />Editar</DropdownMenuItem>
                          {(transaction.effectiveStatus === "pending" || transaction.effectiveStatus === "overdue") && (
                            <>
                              <DropdownMenuItem onClick={() => receiveMutation.mutate(transaction)}><CheckCircle className="h-3.5 w-3.5 mr-2" />Receber</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => cancelMutation.mutate(transaction)}><XCircle className="h-3.5 w-3.5 mr-2" />Cancelar</DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmTransaction(transaction)}><Trash2 className="h-3.5 w-3.5 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="py-14 text-center text-muted-foreground">
                  <TrendingUp className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p className="font-medium">Nenhuma receita encontrada</p>
                  <p className="text-sm">Ajuste os filtros ou clique em "Nova Receita".</p>
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
        defaultType="income"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
        }}
      />

      <AlertDialog open={!!deleteConfirmTransaction} onOpenChange={(open) => !open && setDeleteConfirmTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? O saldo do portador será ajustado automaticamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmTransaction) {
                  deleteMutation.mutate(deleteConfirmTransaction);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
