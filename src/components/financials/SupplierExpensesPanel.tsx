import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Truck,
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileDown,
  Building2,
} from "lucide-react";
import { exportExpensesBySupplier } from "@/lib/financialExportUtils";
import { useAuth } from "@/hooks/useAuth";

interface SupplierExpensesPanelProps {
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

export function SupplierExpensesPanel({ clinicId }: SupplierExpensesPanelProps) {
  const { currentClinic } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  // Fetch expenses with supplier data
  const { data: expenses, isLoading } = useQuery({
    queryKey: ["supplier-expenses", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          financial_categories (name, color),
          suppliers (id, name, cnpj)
        `)
        .eq("clinic_id", clinicId)
        .eq("type", "expense")
        .not("supplier_id", "is", null)
        .order("due_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Process and group expenses by supplier
  const supplierGroups = useMemo(() => {
    if (!expenses) return [];

    const today = startOfDay(new Date());
    const groups: Record<string, {
      supplier: { id: string; name: string; cnpj: string | null };
      expenses: any[];
      totals: { total: number; paid: number; pending: number; overdue: number };
    }> = {};

    expenses.forEach((expense: any) => {
      if (!expense.suppliers) return;

      const supplierId = expense.supplier_id;
      let effectiveStatus = expense.status;

      if (expense.status === "pending" && expense.due_date) {
        const dueDate = startOfDay(parseISO(expense.due_date));
        if (isAfter(today, dueDate)) {
          effectiveStatus = "overdue";
        }
      }

      if (!groups[supplierId]) {
        groups[supplierId] = {
          supplier: expense.suppliers,
          expenses: [],
          totals: { total: 0, paid: 0, pending: 0, overdue: 0 },
        };
      }

      const amount = Number(expense.amount);
      groups[supplierId].expenses.push({ ...expense, effectiveStatus });
      groups[supplierId].totals.total += amount;

      if (expense.status === "paid") {
        groups[supplierId].totals.paid += amount;
      } else if (effectiveStatus === "overdue") {
        groups[supplierId].totals.overdue += amount;
      } else if (effectiveStatus === "pending") {
        groups[supplierId].totals.pending += amount;
      }
    });

    return Object.values(groups)
      .filter((group) => {
        const matchesSearch =
          group.supplier.name.toLowerCase().includes(search.toLowerCase()) ||
          group.supplier.cnpj?.includes(search);

        const matchesStatus =
          statusFilter === "all" ||
          group.expenses.some((e) => e.effectiveStatus === statusFilter);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => b.totals.total - a.totals.total);
  }, [expenses, search, statusFilter]);

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return supplierGroups.reduce(
      (acc, group) => ({
        total: acc.total + group.totals.total,
        paid: acc.paid + group.totals.paid,
        pending: acc.pending + group.totals.pending,
        overdue: acc.overdue + group.totals.overdue,
        suppliers: acc.suppliers + 1,
      }),
      { total: 0, paid: 0, pending: 0, overdue: 0, suppliers: 0 }
    );
  }, [supplierGroups]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const toggleSupplier = (supplierId: string) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    if (!currentClinic) return;

    const exportData = supplierGroups.map((group) => ({
      supplierName: group.supplier.name,
      supplierCnpj: group.supplier.cnpj || "",
      total: group.totals.total,
      paid: group.totals.paid,
      pending: group.totals.pending,
      overdue: group.totals.overdue,
      expenseCount: group.expenses.length,
    }));

    exportExpensesBySupplier(
      currentClinic.name,
      currentClinic.logo_url,
      "Todos os períodos",
      exportData,
      grandTotals,
      format
    );
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
          <h3 className="text-lg font-semibold">Despesas por Fornecedor</h3>
          <p className="text-sm text-muted-foreground">
            Visualize os gastos agrupados por fornecedor
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-500" />
              Total Gasto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(grandTotals.total)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(grandTotals.paid)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(grandTotals.pending)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(grandTotals.overdue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-500" />
              Fornecedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-indigo-600">
              {grandTotals.suppliers}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ do fornecedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Em Aberto</SelectItem>
                  <SelectItem value="overdue">Vencidas</SelectItem>
                  <SelectItem value="paid">Liquidadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Supplier List */}
      <ScrollArea className="h-[600px]">
        <div className="space-y-3">
          {supplierGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma despesa com fornecedor encontrada</p>
              </CardContent>
            </Card>
          ) : (
            supplierGroups.map((group) => (
              <Card key={group.supplier.id}>
                <Collapsible
                  open={expandedSuppliers.has(group.supplier.id)}
                  onOpenChange={() => toggleSupplier(group.supplier.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedSuppliers.has(group.supplier.id) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-semibold">{group.supplier.name}</p>
                            {group.supplier.cnpj && (
                              <p className="text-sm text-muted-foreground">
                                CNPJ: {group.supplier.cnpj}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-bold">{formatCurrency(group.totals.total)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground">Pago</p>
                            <p className="font-medium text-emerald-600">
                              {formatCurrency(group.totals.paid)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground">Pendente</p>
                            <p className="font-medium text-amber-600">
                              {formatCurrency(group.totals.pending + group.totals.overdue)}
                            </p>
                          </div>
                          <Badge variant="secondary">{group.expenses.length} despesas</Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.expenses.map((expense: any) => (
                            <TableRow key={expense.id}>
                              <TableCell>
                                {expense.due_date
                                  ? format(parseISO(expense.due_date), "dd/MM/yyyy", {
                                      locale: ptBR,
                                    })
                                  : "-"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {expense.description}
                              </TableCell>
                              <TableCell>
                                {expense.document_number || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {expense.financial_categories?.color && (
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{
                                        backgroundColor: expense.financial_categories.color,
                                      }}
                                    />
                                  )}
                                  {expense.financial_categories?.name || "-"}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(Number(expense.amount))}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusColors[expense.effectiveStatus]}>
                                  {statusLabels[expense.effectiveStatus]}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
