import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO, startOfMonth, endOfMonth, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  FileDown,
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  PieChart,
  Calendar,
  Truck,
  FolderTree,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import {
  exportFinancialReportToPDF,
  exportFinancialReportToExcel,
  type FinancialReportData,
} from "@/lib/financialExportUtils";

interface FinancialReportsTabProps {
  clinicId: string;
}

type ReportType = "general" | "by-supplier" | "by-category" | "by-period" | "payables" | "receivables";

const reportTypes = [
  { value: "general", label: "Geral", icon: BarChart3 },
  { value: "by-supplier", label: "Por Fornecedor", icon: Truck },
  { value: "by-category", label: "Por Categoria", icon: FolderTree },
  { value: "by-period", label: "Por Período", icon: Calendar },
  { value: "payables", label: "Contas a Pagar", icon: ArrowUpCircle },
  { value: "receivables", label: "Contas a Receber", icon: ArrowDownCircle },
];

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
  overdue: "Vencido",
};

export function FinancialReportsTab({ clinicId }: FinancialReportsTabProps) {
  const { currentClinic } = useAuth();
  const [reportType, setReportType] = useState<ReportType>("general");
  const [startDate, setStartDate] = useState(() => 
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(() => 
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [transactionType, setTransactionType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["financial-transactions-report", clinicId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          financial_categories (id, name, color),
          suppliers (id, name, cnpj),
          patients (full_name)
        `)
        .eq("clinic_id", clinicId)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers for filter
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-filter", clinicId],
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

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ["categories-filter", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_categories")
        .select("id, name, color, type")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Process transactions with effective status
  const processedTransactions = useMemo(() => {
    if (!transactions) return [];

    const today = startOfDay(new Date());

    return transactions.map((t: any) => {
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

  // Apply filters
  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter((t: any) => {
      const matchesType =
        transactionType === "all" || t.type === transactionType;

      const matchesStatus =
        statusFilter === "all" || t.effectiveStatus === statusFilter;

      const matchesSupplier =
        supplierFilter === "all" || t.supplier_id === supplierFilter;

      const matchesCategory =
        categoryFilter === "all" || t.category_id === categoryFilter;

      // For specific report types
      if (reportType === "payables" && t.type !== "expense") return false;
      if (reportType === "receivables" && t.type !== "income") return false;
      if (reportType === "by-supplier" && !t.supplier_id) return false;

      return matchesType && matchesStatus && matchesSupplier && matchesCategory;
    });
  }, [
    processedTransactions,
    transactionType,
    statusFilter,
    supplierFilter,
    categoryFilter,
    reportType,
  ]);

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((t: any) => t.type === "income")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const expense = filteredTransactions
      .filter((t: any) => t.type === "expense")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const pending = filteredTransactions
      .filter((t: any) => t.effectiveStatus === "pending" || t.effectiveStatus === "overdue")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const paid = filteredTransactions
      .filter((t: any) => t.status === "paid")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    return { income, expense, balance: income - expense, pending, paid };
  }, [filteredTransactions]);

  // Group data based on report type
  const groupedData = useMemo(() => {
    if (reportType === "by-supplier") {
      const groups: Record<string, { name: string; total: number; count: number }> = {};
      filteredTransactions.forEach((t: any) => {
        if (!t.suppliers) return;
        const key = t.supplier_id;
        if (!groups[key]) {
          groups[key] = { name: t.suppliers.name, total: 0, count: 0 };
        }
        groups[key].total += Number(t.amount);
        groups[key].count++;
      });
      return Object.values(groups).sort((a, b) => b.total - a.total);
    }

    if (reportType === "by-category") {
      const groups: Record<string, { name: string; color: string; type: string; total: number; count: number }> = {};
      filteredTransactions.forEach((t: any) => {
        if (!t.financial_categories) return;
        const key = t.category_id;
        if (!groups[key]) {
          groups[key] = { 
            name: t.financial_categories.name, 
            color: t.financial_categories.color || "#888",
            type: t.type,
            total: 0, 
            count: 0 
          };
        }
        groups[key].total += Number(t.amount);
        groups[key].count++;
      });
      return Object.values(groups).sort((a, b) => b.total - a.total);
    }

    return [];
  }, [filteredTransactions, reportType]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleExport = (exportFormat: 'pdf' | 'excel') => {
    if (!currentClinic) return;

    const period = `${format(parseISO(startDate), "dd/MM/yyyy")} a ${format(parseISO(endDate), "dd/MM/yyyy")}`;

    const reportData: FinancialReportData = {
      type: reportType,
      transactions: filteredTransactions.map((t: any) => ({
        date: t.due_date ? format(parseISO(t.due_date), "dd/MM/yyyy") : "-",
        description: t.description,
        category: t.financial_categories?.name || "-",
        supplier: t.suppliers?.name || "-",
        patient: t.patients?.full_name || "-",
        amount: Number(t.amount),
        transactionType: t.type,
        status: statusLabels[t.effectiveStatus] || t.effectiveStatus,
      })),
      groupedData: groupedData,
      totals,
    };

    if (exportFormat === 'pdf') {
      exportFinancialReportToPDF(
        currentClinic.name,
        currentClinic.logo_url,
        period,
        reportTypes.find(r => r.value === reportType)?.label || "Relatório",
        reportData
      );
    } else {
      exportFinancialReportToExcel(
        currentClinic.name,
        period,
        reportTypes.find(r => r.value === reportType)?.label || "Relatório",
        reportData
      );
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Relatórios Financeiros</h3>
          <p className="text-sm text-muted-foreground">
            Gere relatórios personalizados com filtros avançados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button size="sm" onClick={() => handleExport('pdf')}>
            <FileText className="h-4 w-4 mr-2" />
            Imprimir PDF
          </Button>
        </div>
      </div>

      {/* Report Type Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Tipo de Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {reportTypes.map((type) => {
              const Icon = type.icon;
              const isActive = reportType === type.value;
              return (
                <Button
                  key={type.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReportType(type.value as ReportType)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {type.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label className="text-xs">Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receitas</SelectItem>
                  <SelectItem value="expense">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
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
              <Label className="text-xs">Categoria</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totals.income)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.expense)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-indigo-500" />
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(totals.balance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4 text-amber-500" />
              Pendente
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
              <BarChart3 className="h-4 w-4 text-slate-500" />
              Registros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filteredTransactions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Data (for by-supplier and by-category reports) */}
      {(reportType === "by-supplier" || reportType === "by-category") && groupedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {reportType === "by-supplier" ? "Resumo por Fornecedor" : "Resumo por Categoria"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{reportType === "by-supplier" ? "Fornecedor" : "Categoria"}</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedData.map((group: any, idx) => {
                  const totalSum = groupedData.reduce((sum: number, g: any) => sum + g.total, 0);
                  const percentage = totalSum > 0 ? (group.total / totalSum) * 100 : 0;
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {group.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                          )}
                          {group.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(group.total)}
                      </TableCell>
                      <TableCell className="text-right">{group.count}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-12 text-right">{percentage.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  {reportType === "by-supplier" && <TableHead>Fornecedor</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma transação encontrada para os filtros selecionados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {t.due_date
                          ? format(parseISO(t.due_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {t.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {t.financial_categories?.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: t.financial_categories.color }}
                            />
                          )}
                          {t.financial_categories?.name || "-"}
                        </div>
                      </TableCell>
                      {reportType === "by-supplier" && (
                        <TableCell>{t.suppliers?.name || "-"}</TableCell>
                      )}
                      <TableCell>
                        <Badge variant={t.type === "income" ? "default" : "secondary"}>
                          {t.type === "income" ? "Receita" : "Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'} {formatCurrency(Number(t.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            t.effectiveStatus === "paid"
                              ? "default"
                              : t.effectiveStatus === "overdue"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {statusLabels[t.effectiveStatus] || t.effectiveStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
