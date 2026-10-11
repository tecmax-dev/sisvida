import { useState, useMemo, useCallback, Fragment } from "react";
import { useMutation } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionFinancialData } from "@/hooks/useUnionFinancialData";
import { formatDateBR, parseDateOnlyToLocalNoon } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, subDays, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Download, Building2, Calendar as CalendarIcon, AlertCircle, RefreshCw, Plus, RotateCcw, Trash2, MoreHorizontal, Pencil, Check, X, Loader2, ArrowLeftRight, Wallet, TrendingDown, TrendingUp, Landmark } from "lucide-react";
import { KpiCard, CountTabs } from "@/components/design-system";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { UnionTransactionDialog } from "./UnionTransactionDialog";
import { UnionCashTransferDialog } from "./UnionCashTransferDialog";

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: string;
  amount: number;
  status: string;
  supplier_name?: string;
  check_number?: string;
  is_conciliated?: boolean;
}

interface DailyGroup {
  date: Date;
  dateStr: string;
  transactions: Transaction[];
  totalDebit: number;
  totalCredit: number;
  endDayBalance: number;
}

interface StatementSummary {
  totalRecords: number;
  initialBalance: number;
  totalDebits: number;
  totalCredits: number;
  finalBalance: number;
}

const parseBrDateDigitsToLocalNoon = (digits: string) => {
  if (digits.length !== 8) return null;

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const parsed = parseDateOnlyToLocalNoon(`${year}-${month}-${day}`);

  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }

  return parsed;
};

export function UnionStatementPanel() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;

  const [cashRegisterId, setCashRegisterId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => endOfMonth(new Date()));
  const [isMigrating, setIsMigrating] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [rowSearch, setRowSearch] = useState("");
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isEditingInitialBalanceDate, setIsEditingInitialBalanceDate] = useState(false);
  const [initialBalanceDateInput, setInitialBalanceDateInput] = useState("");
  const [savingInitialBalanceDate, setSavingInitialBalanceDate] = useState(false);
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["union-statement-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["union-statement-previous-balance-v3"] });
    queryClient.invalidateQueries({ queryKey: ["union-cash-registers-statement"] });
    queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
  }, [queryClient]);

  // Estorno mutation - creates a reverse transaction
  const estornoMutation = useMutation({
    mutationFn: async (transaction: Transaction) => {
      // Create reverse transaction
      const reverseType = transaction.type === "expense" ? "income" : "expense";
      const { error: insertError } = await supabase
        .from("union_financial_transactions")
        .insert({
          clinic_id: clinicId!,
          type: reverseType,
          description: `ESTORNO: ${transaction.description}`,
          amount: transaction.amount,
          cash_register_id: cashRegisterId,
          status: "paid",
          paid_date: format(new Date(), "yyyy-MM-dd"),
          due_date: format(new Date(), "yyyy-MM-dd"),
          payment_method: "other",
          notes: `Estorno do lançamento ID ${transaction.id}`,
        });
      if (insertError) throw insertError;
      // Saldo do portador é recalculado automaticamente pelo banco.
    },
    onSuccess: () => {
      toast.success("Lançamento estornado com sucesso!");
      invalidateAll();
    },
    onError: (error: any) => {
      toast.error("Erro ao estornar: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (transaction: Transaction) => {
      // Update status to cancelled first to bypass paid deletion trigger
      if (transaction.status === "paid") {
        const { error: statusError } = await supabase
          .from("union_financial_transactions")
          .update({ status: "cancelled" })
          .eq("id", transaction.id);
        if (statusError) throw statusError;
      }

      const { error } = await supabase
        .from("union_financial_transactions")
        .delete()
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso!");
      setDeleteConfirmId(null);
      invalidateAll();
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir: " + error.message);
      setDeleteConfirmId(null);
    },
  });

  // Use unified hook with fallback
  const {
    cashRegisters: fallbackRegisters,
    cashRegistersSource,
    loadingCashRegisters,
    migrateData,
  } = useUnionFinancialData(clinicId);

  // Fetch union cash registers directly
  const { data: unionRegisters, isLoading: loadingUnionRegisters, refetch } = useQuery({
    queryKey: ["union-cash-registers-statement", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_cash_registers")
        .select("id, name, current_balance, type, initial_balance, initial_balance_date")
        .eq("clinic_id", clinicId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Use union registers if available, otherwise fallback
  const cashRegisters = unionRegisters && unionRegisters.length > 0 ? unionRegisters : fallbackRegisters;
  const isUsingFallback = cashRegistersSource === "clinic" && (!unionRegisters || unionRegisters.length === 0);

  // Handle migration
  const handleMigrate = useCallback(async () => {
    setIsMigrating(true);
    try {
      const success = await migrateData();
      if (success) {
        refetch();
      }
    } finally {
      setIsMigrating(false);
    }
  }, [migrateData, refetch]);

  // Safe date setters to ensure valid dates
  const handleStartDateChange = useCallback((date: Date | undefined) => {
    if (date && isValid(date)) {
      setStartDate(date);
    }
  }, []);

  const handleEndDateChange = useCallback((date: Date | undefined) => {
    if (date && isValid(date)) {
      setEndDate(date);
    }
  }, []);

  // Get selected register info
  const selectedRegister = useMemo(() => {
    return cashRegisters?.find((r) => r.id === cashRegisterId);
  }, [cashRegisters, cashRegisterId]);

  const previousBalanceDate = useMemo(() => subDays(startDate, 1), [startDate]);
  const previousBalanceDateLabel = useMemo(() => format(previousBalanceDate, "dd/MM/yyyy"), [previousBalanceDate]);

  const handleStartInitialBalanceDateEdit = useCallback(() => {
    if (!selectedRegister) return;

    const currentDate = (selectedRegister as any)?.initial_balance_date
      ? String((selectedRegister as any).initial_balance_date).slice(0, 10)
      : format(subDays(startDate, 1), "yyyy-MM-dd");

    setInitialBalanceDateInput(currentDate);
    setIsEditingInitialBalanceDate(true);
  }, [selectedRegister, startDate]);

  const handleCancelInitialBalanceDateEdit = useCallback(() => {
    setIsEditingInitialBalanceDate(false);
    setInitialBalanceDateInput("");
  }, []);

  const handleSaveInitialBalanceDate = useCallback(async () => {
    if (!selectedRegister || !initialBalanceDateInput) return;

    setSavingInitialBalanceDate(true);
    try {
      const { error } = await supabase
        .from("union_cash_registers")
        .update({ initial_balance_date: initialBalanceDateInput })
        .eq("id", selectedRegister.id);

      if (error) throw error;

      toast.success("Data do saldo atualizada");
      setIsEditingInitialBalanceDate(false);
      invalidateAll();
    } catch (err: any) {
      toast.error("Erro ao atualizar data: " + err.message);
    } finally {
      setSavingInitialBalanceDate(false);
    }
  }, [initialBalanceDateInput, invalidateAll, selectedRegister]);

  const handleInitialBalanceDateKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSaveInitialBalanceDate();
      } else if (e.key === "Escape") {
        handleCancelInitialBalanceDateEdit();
      }
    },
    [handleCancelInitialBalanceDateEdit, handleSaveInitialBalanceDate]
  );

  // Fetch transactions for the period and cash register (with pagination to bypass 1000-row limit)
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["union-statement-transactions", clinicId, cashRegisterId, startDate, endDate],
    queryFn: async () => {
      const allTransactions: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      while (hasMore) {
        const { data, error } = await supabase
          .from("union_financial_transactions")
          .select("id, paid_date, due_date, description, type, amount, status, check_number, is_conciliated, supplier_id, union_suppliers(name)")
          .eq("clinic_id", clinicId!)
          .eq("cash_register_id", cashRegisterId)
          .eq("status", "paid")
          .gte("paid_date", startStr)
          .lte("paid_date", endStr)
          .order("paid_date", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allTransactions.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      return allTransactions.map((t: any) => ({
        id: t.id,
        date: t.paid_date || t.due_date || "",
        description: t.description || "Sem descrição",
        type: t.type,
        amount: Number(t.amount) || 0,
        status: t.status,
        supplier_name: t.union_suppliers?.name || undefined,
        check_number: t.check_number || undefined,
        is_conciliated: t.is_conciliated || false,
      }));
    },
    enabled: !!clinicId && !!cashRegisterId,
  });

  // Calculate initial balance (saldo anterior) - fetch register data directly to avoid cache issues
  const { data: previousBalance } = useQuery({
    queryKey: ["union-statement-previous-balance-v3", clinicId, cashRegisterId, startDate],
    queryFn: async () => {
      // Fetch register data directly to get initial_balance and initial_balance_date
      const { data: registerData, error: regError } = await supabase
        .from("union_cash_registers")
        .select("initial_balance, initial_balance_date")
        .eq("id", cashRegisterId)
        .single();

      if (regError) throw regError;

      const initialBalanceDate = registerData?.initial_balance_date as string | null;
      const initialBalanceValue = Number(registerData?.initial_balance) || 0;

      const startDateOnly = format(startDate, "yyyy-MM-dd");

      // Base = initial_balance (saldo declarado na initial_balance_date).
      // Only apply o gate de initial_balance_date quando initial_balance != 0,
      // pois nesse caso as transações anteriores a essa data já estão
      // representadas dentro do saldo inicial. Quando initial_balance é 0,
      // somamos todas as transações pagas anteriores à startDate para
      // refletir o current_balance real da conta.
      let base = initialBalanceValue;
      let lowerBoundDate: string | undefined;

      if (initialBalanceDate && initialBalanceValue !== 0) {
        const initDateLocalNoon = parseDateOnlyToLocalNoon(initialBalanceDate);
        const startDateNoon = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0, 0);

        if (startDateNoon.getTime() > initDateLocalNoon.getTime()) {
          lowerBoundDate = initialBalanceDate;
        } else {
          // Período começa em/antes da data do saldo inicial declarado.
          return initialBalanceValue;
        }
      }

      // Get paid transactions before startDate for this register (paginated)
      const allPrev: any[] = [];
      let prevOffset = 0;
      const prevBatch = 1000;
      let prevHasMore = true;

      while (prevHasMore) {
        let query = supabase
          .from("union_financial_transactions")
          .select("id, type, amount, paid_date, created_at")
          .eq("clinic_id", clinicId!)
          .eq("cash_register_id", cashRegisterId)
          .eq("status", "paid")
          .lt("paid_date", startDateOnly)
          .order("paid_date", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(prevOffset, prevOffset + prevBatch - 1);

        if (lowerBoundDate) {
          query = query.gt("paid_date", lowerBoundDate);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          allPrev.push(...data);
          prevOffset += prevBatch;
          prevHasMore = data.length === prevBatch;
        } else {
          prevHasMore = false;
        }
      }

      // Sum (income - expense)
      let delta = 0;
      allPrev.forEach((t) => {
        const amount = Number(t.amount) || 0;
        if (t.type === "income") {
          delta += amount;
        } else {
          delta -= amount;
        }
      });

      return base + delta;
    },
    enabled: !!clinicId && !!cashRegisterId,
  });

  // Group transactions by day and calculate running balance
  const { dailyGroups, summary } = useMemo(() => {
    if (!transactions) {
      return { dailyGroups: [], summary: null };
    }

    const groups: Map<string, DailyGroup> = new Map();
    let runningBalance = previousBalance || 0;
    let totalDebits = 0;
    let totalCredits = 0;

    transactions.forEach((t) => {
      const dateStr = t.date;
      if (!groups.has(dateStr)) {
        groups.set(dateStr, {
          date: parseDateOnlyToLocalNoon(dateStr),
          dateStr,
          transactions: [],
          totalDebit: 0,
          totalCredit: 0,
          endDayBalance: 0,
        });
      }

      const group = groups.get(dateStr)!;
      const amount = t.amount;

      if (t.type === "expense") {
        group.totalDebit += amount;
        totalDebits += amount;
        runningBalance -= amount;
      } else {
        group.totalCredit += amount;
        totalCredits += amount;
        runningBalance += amount;
      }

      group.transactions.push({
        ...t,
        // Store running balance at this point for the line
      });
      group.endDayBalance = runningBalance;
    });

    // Recalculate line-by-line balance
    let lineBalance = previousBalance || 0;
    const sortedGroups = Array.from(groups.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    sortedGroups.forEach((group) => {
      group.transactions.forEach((t) => {
        if (t.type === "expense") {
          lineBalance -= t.amount;
        } else {
          lineBalance += t.amount;
        }
        (t as any).lineBalance = lineBalance;
      });
      group.endDayBalance = lineBalance;
    });

    const summary: StatementSummary = {
      totalRecords: transactions.length,
      initialBalance: previousBalance || 0,
      totalDebits,
      totalCredits,
      finalBalance: (previousBalance || 0) + totalCredits - totalDebits,
    };

    return { dailyGroups: sortedGroups, summary };
  }, [transactions, previousBalance]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleExportPDF = () => {
    if (!summary || !selectedRegister) return;

    const doc = new jsPDF({ orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // Header
    if (currentClinic?.logo_url) {
      try {
        doc.addImage(currentClinic.logo_url, "PNG", 20, 10, 30, 30);
        yPos = 45;
      } catch (e) {
        yPos = 15;
      }
    }

    // Title and entity info
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(currentClinic?.name || "Entidade Sindical", pageWidth / 2, yPos, { align: "center" });
    yPos += 6;
    
    if (currentClinic?.cnpj) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(currentClinic.cnpj, pageWidth / 2, yPos, { align: "center" });
      yPos += 8;
    }

    // Report title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("MOVIMENTAÇÃO E SALDO", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    // Period and register info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const periodText = `Portador: ${selectedRegister.name} - Período: De ${format(startDate, "dd/MM/yyyy")} até ${format(endDate, "dd/MM/yyyy")}`;
    doc.text(periodText, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    // Previous balance table
    autoTable(doc, {
      startY: yPos,
      head: [["DATA", "SALDO ANTERIOR"]],
      body: [[previousBalanceDateLabel, formatCurrency(summary.initialBalance)]],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], fontStyle: "bold" },
      styles: { fontSize: 9 },
      margin: { left: 20, right: 5 },
      columnStyles: { 0: { cellWidth: 40 }, 1: { halign: "right" } },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Transactions table with daily subtotals
    const tableBody: any[] = [];

    dailyGroups.forEach((group) => {
      group.transactions.forEach((t) => {
        tableBody.push([
          format(group.date, "dd/MM/yyyy"),
          t.description.toUpperCase(),
          t.check_number || "",
          t.supplier_name || "",
          t.type === "expense" ? formatCurrency(t.amount) : "",
          t.type === "income" ? formatCurrency(t.amount) : "",
          formatCurrency((t as any).lineBalance),
          t.is_conciliated ? "Sim" : "Não",
        ]);
      });

      // Daily subtotal row with colored values
      const dailyBalanceColor = group.endDayBalance >= 0 ? [22, 163, 74] : [220, 38, 38];
      tableBody.push([
        { content: `Total do dia ${format(group.date, "dd/MM/yyyy")}:`, colSpan: 4, styles: { fontStyle: "bold", fillColor: [241, 245, 249], fontSize: 8 } },
        { content: formatCurrency(-group.totalDebit), styles: { fontStyle: "bold", fillColor: [241, 245, 249], fontSize: 8, halign: "right", textColor: [220, 38, 38] } },
        { content: formatCurrency(group.totalCredit), styles: { fontStyle: "bold", fillColor: [241, 245, 249], fontSize: 8, halign: "right", textColor: [22, 163, 74] } },
        { content: formatCurrency(group.endDayBalance), styles: { fontStyle: "bold", fillColor: [241, 245, 249], fontSize: 8, halign: "right", textColor: dailyBalanceColor } },
        { content: "", styles: { fillColor: [241, 245, 249] } },
      ]);
    });

    autoTable(doc, {
      startY: yPos,
      head: [["DATA", "DESCRIÇÃO", "CHQ", "FORNECEDOR", "DÉBITO", "CRÉDITO", "SALDO", "CONC."]],
      body: tableBody,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], fontStyle: "bold", fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      margin: { left: 20, right: 5 },
      tableWidth: "auto",
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 15 },
        3: { cellWidth: 30 },
        4: { cellWidth: 20, halign: "right", textColor: [220, 38, 38] },
        5: { cellWidth: 20, halign: "right", textColor: [22, 163, 74] },
        6: { cellWidth: 22, halign: "right" },
        7: { cellWidth: 14, halign: "center" },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Summary table
    autoTable(doc, {
      startY: yPos,
      head: [["REGISTROS", "TOTAL INICIAL", "TOTAL DÉBITOS", "TOTAL CRÉDITO", "TOTAL FINAL"]],
      body: [
        [
          summary.totalRecords.toString(),
          formatCurrency(summary.initialBalance),
          formatCurrency(summary.totalDebits),
          formatCurrency(summary.totalCredits),
          formatCurrency(summary.finalBalance),
        ],
      ],
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: 20, right: 5 },
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "right" },
        2: { halign: "right", textColor: [220, 38, 38] },
        3: { halign: "right", textColor: [22, 163, 74] },
        4: { halign: "right", textColor: [37, 99, 235] },
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Página ${i} de ${pageCount} - Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    doc.save(`movimentacao-saldo-${format(startDate, "yyyy-MM")}.pdf`);
  };

  const handleExportExcel = () => {
    if (!summary || !selectedRegister) return;

    const wsData: any[] = [];

    // Header info
    wsData.push([currentClinic?.name || "Entidade Sindical"]);
    wsData.push([currentClinic?.cnpj || ""]);
    wsData.push(["MOVIMENTAÇÃO E SALDO"]);
    wsData.push([`Portador: ${selectedRegister.name} - Período: De ${format(startDate, "dd/MM/yyyy")} até ${format(endDate, "dd/MM/yyyy")}`]);
    wsData.push([]);

    // Previous balance
    wsData.push(["DATA", "SALDO ANTERIOR"]);
    wsData.push([previousBalanceDateLabel, summary.initialBalance]);
    wsData.push([]);

    // Transactions header
    wsData.push(["DATA", "DESCRIÇÃO", "Nº CHEQUE", "FORNECEDOR", "DÉBITO", "CRÉDITO", "SALDO"]);

    dailyGroups.forEach((group) => {
      group.transactions.forEach((t) => {
        wsData.push([
          format(group.date, "dd/MM/yyyy"),
          t.description.toUpperCase(),
          t.check_number || "",
          t.supplier_name || "",
          t.type === "expense" ? t.amount : "",
          t.type === "income" ? t.amount : "",
          (t as any).lineBalance,
        ]);
      });

      // Daily subtotal
      wsData.push([
        `Total do dia ${format(group.date, "dd/MM/yyyy")}`,
        "",
        "",
        "",
        -group.totalDebit,
        group.totalCredit,
        group.endDayBalance,
      ]);
    });

    wsData.push([]);

    // Summary
    wsData.push(["REGISTROS", "TOTAL INICIAL", "TOTAL DÉBITOS", "TOTAL CRÉDITO", "TOTAL FINAL"]);
    wsData.push([
      summary.totalRecords,
      summary.initialBalance,
      summary.totalDebits,
      summary.totalCredits,
      summary.finalBalance,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentação e Saldo");
    XLSX.writeFile(wb, `movimentacao-saldo-${format(startDate, "yyyy-MM")}.xlsx`);
  };

  if (!clinicId) return null;

  if (loadingUnionRegisters && loadingCashRegisters) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><ArrowLeftRight className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Movimentação e Saldo</h1>
            <p className="text-sm text-muted-foreground">Extrato detalhado de movimentações por conta bancária.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2"><MoreHorizontal className="h-4 w-4" />Mais ações</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setTransferDialogOpen(true)}><ArrowLeftRight className="h-4 w-4 mr-2" />Transferência</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} disabled={!cashRegisterId || !summary}><Download className="h-4 w-4 mr-2" />Exportar PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} disabled={!cashRegisterId || !summary}><FileText className="h-4 w-4 mr-2" />Exportar Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setTransactionDialogOpen(true)} className="h-9 gap-1"><Plus className="h-4 w-4" />Novo Lançamento</Button>
        </div>
      </div>

      {/* Migration Alert */}
      {isUsingFallback && cashRegisters.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Exibindo contas da clínica vinculada. Clique para importar para o módulo sindical.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMigrate}
              disabled={isMigrating}
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Importar Contas
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            {/* Row 1: Portador selector - full width */}
            <div className="space-y-1 lg:min-w-[280px] lg:flex-1">
              <Label className="text-xs text-muted-foreground">Conta bancária</Label>
              <Select value={cashRegisterId} onValueChange={setCashRegisterId}>
                <SelectTrigger className="w-full h-9 bg-background">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Selecione o portador" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-[9999]">
                  {cashRegisters?.map((register) => (
                    <SelectItem key={register.id} value={register.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span>{register.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Date filters and export buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              {/* Date filters group */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <input
                          type="text"
                          className="flex h-9 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="dd/mm/aaaa"
                          value={format(startDate, "dd/MM/yyyy")}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Auto-format: insert slashes
                            const parsed = parseBrDateDigitsToLocalNoon(val.replace(/\D/g, ""));
                            if (parsed) {
                              handleStartDateChange(parsed);
                            }
                          }}
                          onBlur={(e) => {
                            const parsed = parseBrDateDigitsToLocalNoon(e.target.value.replace(/\D/g, ""));
                            if (parsed) {
                              handleStartDateChange(parsed);
                            }
                          }}
                        />
                        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border z-[9999]" align="start" sideOffset={4}>
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={handleStartDateChange}
                        locale={ptBR}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <input
                          type="text"
                          className="flex h-9 w-full sm:w-[150px] rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          placeholder="dd/mm/aaaa"
                          value={format(endDate, "dd/MM/yyyy")}
                          onChange={(e) => {
                            const parsed = parseBrDateDigitsToLocalNoon(e.target.value.replace(/\D/g, ""));
                            if (parsed) {
                              handleEndDateChange(parsed);
                            }
                          }}
                          onBlur={(e) => {
                            const parsed = parseBrDateDigitsToLocalNoon(e.target.value.replace(/\D/g, ""));
                            if (parsed) {
                              handleEndDateChange(parsed);
                            }
                          }}
                        />
                        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border z-[9999]" align="start" sideOffset={4}>
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={handleEndDateChange}
                        locale={ptBR}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statement Content */}
      {!cashRegisterId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione um portador para visualizar o extrato</p>
          </CardContent>
        </Card>
      ) : loadingTransactions ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          {/* Indicadores */}
          {summary && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Saldo anterior" value={formatCurrency(summary.initialBalance)} icon={Wallet}
                hint={<span className="flex flex-wrap items-center gap-1"><span>{previousBalanceDateLabel}</span>
                          {isEditingInitialBalanceDate ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={initialBalanceDateInput}
                                onChange={(e) => setInitialBalanceDateInput(e.target.value)}
                                onKeyDown={handleInitialBalanceDateKeyDown}
                                className="h-8 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                disabled={savingInitialBalanceDate}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => void handleSaveInitialBalanceDate()}
                                disabled={savingInitialBalanceDate || !initialBalanceDateInput}
                                title="Salvar data-base"
                              >
                                {savingInitialBalanceDate ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={handleCancelInitialBalanceDateEdit}
                                disabled={savingInitialBalanceDate}
                                title="Cancelar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (selectedRegister as any)?.initial_balance_date ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              title="Ajustar data-base do saldo cadastrado"
                              onClick={handleStartInitialBalanceDateEdit}
                            >
                              Base: {formatDateBR(String((selectedRegister as any).initial_balance_date))}
                              <Pencil className="h-3 w-3" />
                            </button>
                          ) : null}</span>} />
              <KpiCard label="Débitos" active={typeFilter === "expense"} onClick={() => setTypeFilter(typeFilter === "expense" ? "all" : "expense")} tone="destructive" value={formatCurrency(summary.totalDebits)} icon={TrendingDown} hint={`${summary.totalRecords} registros no período`} />
              <KpiCard label="Créditos" active={typeFilter === "income"} onClick={() => setTypeFilter(typeFilter === "income" ? "all" : "income")} tone="success" value={formatCurrency(summary.totalCredits)} icon={TrendingUp} />
              <KpiCard label="Saldo final" tone="primary" value={formatCurrency(summary.finalBalance)} icon={Landmark} />
            </div>
          )}

          {/* Transactions Table */}
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-0">
              <CountTabs
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as "all" | "expense" | "income")}
                items={(() => { const all = dailyGroups.flatMap((g) => g.transactions); return [
                  { value: "all" as const, label: "Todos", count: all.length },
                  { value: "expense" as const, label: "Débitos", count: all.filter((t) => t.type === "expense").length, tone: "destructive" as const },
                  { value: "income" as const, label: "Créditos", count: all.filter((t) => t.type === "income").length, tone: "success" as const },
                ]; })()}
              />
              <div className="flex items-center gap-2 border-b p-2">
                <input
                  value={rowSearch}
                  onChange={(e) => setRowSearch(e.target.value)}
                  placeholder="Buscar por descrição, fornecedor ou cheque..."
                  className="h-8 w-full max-w-sm rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="max-h-[calc(100vh-360px)] min-h-[320px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                     <TableRow className="text-[11px] uppercase tracking-wide [&>th]:font-medium [&>th]:text-muted-foreground">
                       <TableHead className="font-bold w-[100px]">DATA</TableHead>
                       <TableHead className="font-bold">DESCRIÇÃO</TableHead>
                       <TableHead className="font-bold w-[90px] text-center">CONC.</TableHead>
                       <TableHead className="font-bold w-[100px]">Nº CHEQUE</TableHead>
                       <TableHead className="font-bold w-[150px]">FORNECEDOR</TableHead>
                       <TableHead className="text-right font-bold w-[120px]">DÉBITO</TableHead>
                       <TableHead className="text-right font-bold w-[120px]">CRÉDITO</TableHead>
                       <TableHead className="text-right font-bold w-[140px]">SALDO</TableHead>
                       <TableHead className="w-[50px]"></TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyGroups.map((group) => { const q = rowSearch.trim().toLowerCase(); const rows = group.transactions.filter((t: any) => (typeFilter === "all" || t.type === typeFilter) && (!q || [t.description, t.supplier_name, t.check_number].some((v) => String(v || "").toLowerCase().includes(q)))); if (rows.length === 0) return null; return (
                      <Fragment key={group.dateStr}>
                        {rows.map((t, idx) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">
                              {idx === 0 ? format(group.date, "dd/MM/yyyy") : ""}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-foreground">{t.description}</TableCell>
                            <TableCell className="text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center min-w-12 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  t.is_conciliated
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                    : "bg-muted text-muted-foreground"
                                )}
                                title={t.is_conciliated ? "Conciliado" : "Não conciliado"}
                              >
                                {t.is_conciliated ? "SIM" : "NÃO"}
                              </span>
                            </TableCell>
                             <TableCell className="text-sm">{t.check_number || ""}</TableCell>
                             <TableCell className="text-sm">{t.supplier_name || ""}</TableCell>
                             <TableCell className="text-right tabular-nums text-destructive">
                              {t.type === "expense" ? formatCurrency(t.amount) : ""}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-success">
                              {t.type === "income" ? formatCurrency(t.amount) : ""}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency((t as any).lineBalance)}
                            </TableCell>
                            <TableCell className="p-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      // Fetch full transaction data for editing
                                      const { data: fullTx } = await supabase
                                        .from("union_financial_transactions")
                                        .select("*")
                                        .eq("id", t.id)
                                        .single();
                                      if (fullTx) {
                                        setEditTransaction(fullTx);
                                        setTransactionDialogOpen(true);
                                      }
                                    }}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => estornoMutation.mutate(t)}
                                    disabled={estornoMutation.isPending}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Estornar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteConfirmId(t.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Daily subtotal */}
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={9} className="py-1.5 text-xs font-medium text-muted-foreground">
                            Total do dia {format(group.date, "dd/MM/yyyy")}:{" "}
                            <span className="text-destructive">Débito: {formatCurrency(-group.totalDebit)}</span>
                            {" - "}
                            <span className="text-success">Crédito: {formatCurrency(group.totalCredit)}</span>
                            {" - "}
                            Saldo: {formatCurrency(group.endDayBalance)}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    ); })}

                    {dailyGroups.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          Nenhuma movimentação encontrada no período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </>
      )}
      {/* Transaction Dialog */}
      {clinicId && (
        <UnionTransactionDialog
          open={transactionDialogOpen}
          onOpenChange={(open) => {
            setTransactionDialogOpen(open);
            if (!open) setEditTransaction(null);
          }}
          transaction={editTransaction}
          clinicId={clinicId}
          cashRegisterId={cashRegisterId || undefined}
          defaultPaid
          onSuccess={() => {
            setEditTransaction(null);
            queryClient.invalidateQueries({ queryKey: ["union-statement-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["union-statement-previous-balance-v3"] });
            queryClient.invalidateQueries({ queryKey: ["union-cash-registers-statement"] });
            queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
          }}
        />
      )}

      {/* Transfer Dialog */}
      {clinicId && (
        <UnionCashTransferDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          clinicId={clinicId}
        />
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
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
                if (!deleteConfirmId) return;
                // Find the transaction across all groups
                for (const group of dailyGroups) {
                  const t = group.transactions.find((tx) => tx.id === deleteConfirmId);
                  if (t) {
                    deleteMutation.mutate(t);
                    break;
                  }
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
