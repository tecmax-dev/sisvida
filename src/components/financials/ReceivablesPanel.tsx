import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isPast, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { MoreHorizontal, Check, Search, AlertCircle, Clock, CalendarDays } from "lucide-react";
import { FinancialExportButton } from "./FinancialExportButton";
import { exportReceivables, ReceivableData } from "@/lib/financialExportUtils";

interface ReceivablesPanelProps {
  clinicId: string;
}

export function ReceivablesPanel({ clinicId }: ReceivablesPanelProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");

  const { data: receivables, isLoading } = useQuery({
    queryKey: ["receivables", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          patients (name, phone),
          procedures (name),
          financial_categories (name)
        `)
        .eq("clinic_id", clinicId)
        .eq("type", "income")
        .eq("status", "pending")
        .order("due_date");

      if (error) throw error;
      return data;
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_transactions")
        .update({
          status: "paid",
          paid_date: format(new Date(), "yyyy-MM-dd"),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      toast.success("Recebimento confirmado!");
    },
    onError: () => {
      toast.error("Erro ao confirmar recebimento");
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const getStatusInfo = (dueDate: string | null) => {
    if (!dueDate) return { label: "Sem data", color: "bg-muted text-muted-foreground", icon: Clock };
    
    const date = parseISO(dueDate);
    const today = new Date();
    
    if (isToday(date)) {
      return { label: "Vence hoje", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: CalendarDays };
    }
    
    if (isPast(date)) {
      const daysOverdue = differenceInDays(today, date);
      return { 
        label: `${daysOverdue} dia(s) atrasado`, 
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        icon: AlertCircle 
      };
    }
    
    const daysUntil = differenceInDays(date, today);
    return { 
      label: `Em ${daysUntil} dia(s)`, 
      color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      icon: Clock 
    };
  };

  const filteredReceivables = receivables?.filter((r) => {
    // Search filter
    const matchesSearch = 
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      (r.patients as any)?.name?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    // Status filter
    if (filter === "all") return true;
    
    if (!r.due_date) return false;
    
    const date = parseISO(r.due_date);
    
    if (filter === "overdue") return isPast(date) && !isToday(date);
    if (filter === "today") return isToday(date);
    if (filter === "upcoming") return !isPast(date) && !isToday(date);
    
    return true;
  });

  // Summary calculations
  const totalReceivables = receivables?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
  const overdueAmount = receivables
    ?.filter((r) => r.due_date && isPast(parseISO(r.due_date)) && !isToday(parseISO(r.due_date)))
    .reduce((sum, r) => sum + Number(r.amount), 0) || 0;
  const todayAmount = receivables
    ?.filter((r) => r.due_date && isToday(parseISO(r.due_date)))
    .reduce((sum, r) => sum + Number(r.amount), 0) || 0;

  const handleExport = (exportFormat: 'pdf' | 'excel') => {
    const exportData: ReceivableData[] = (filteredReceivables || []).map(r => ({
      dueDate: r.due_date ? format(parseISO(r.due_date), "dd/MM/yyyy", { locale: ptBR }) : "-",
      description: r.description,
      patient: (r.patients as any)?.name || "-",
      status: getStatusInfo(r.due_date).label,
      amount: Number(r.amount),
    }));
    
    exportReceivables(
      "Clínica",
      "Período atual",
      exportData,
      { total: totalReceivables, overdue: overdueAmount, today: todayAmount },
      exportFormat
    );
  };

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Controle de Recebíveis</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie suas contas a receber
          </p>
        </div>
        <FinancialExportButton
          onExportPDF={() => handleExport('pdf')}
          onExportExcel={() => handleExport('excel')}
          disabled={!filteredReceivables?.length}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totalReceivables)}
            </p>
            <p className="text-xs text-muted-foreground">
              {receivables?.length || 0} título(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Em Atraso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(overdueAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {receivables?.filter((r) => r.due_date && isPast(parseISO(r.due_date)) && !isToday(parseISO(r.due_date))).length || 0} título(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-500" />
              Vence Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(todayAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {receivables?.filter((r) => r.due_date && isToday(parseISO(r.due_date))).length || 0} título(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Contas a Receber</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                Todos
              </Button>
              <Button
                variant={filter === "overdue" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setFilter("overdue")}
              >
                Atrasados
              </Button>
              <Button
                variant={filter === "today" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilter("today")}
              >
                Hoje
              </Button>
              <Button
                variant={filter === "upcoming" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilter("upcoming")}
              >
                A vencer
              </Button>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredReceivables && filteredReceivables.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceivables.map((receivable) => {
                  const statusInfo = getStatusInfo(receivable.due_date);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <TableRow key={receivable.id}>
                      <TableCell>
                        {receivable.due_date
                          ? format(parseISO(receivable.due_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {receivable.description}
                      </TableCell>
                      <TableCell>
                        {(receivable.patients as any)?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusInfo.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(Number(receivable.amount))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => markPaidMutation.mutate(receivable.id)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Confirmar Recebimento
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum recebível encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
