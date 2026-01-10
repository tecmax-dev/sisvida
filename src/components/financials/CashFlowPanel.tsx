import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Plus } from "lucide-react";
import { FinancialExportButton } from "./FinancialExportButton";
import { exportCashFlow, CashFlowData } from "@/lib/financialExportUtils";
import { Badge } from "@/components/ui/badge";
import { NewCashFlowEntryDialog } from "./NewCashFlowEntryDialog";

interface CashFlowPanelProps {
  clinicId: string;
}

export function CashFlowPanel({ clinicId }: CashFlowPanelProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newEntryDialogOpen, setNewEntryDialogOpen] = useState(false);
  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["cash-flow", clinicId, format(startDate, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("due_date", format(startDate, "yyyy-MM-dd"))
        .lte("due_date", format(endDate, "yyyy-MM-dd"))
        .order("due_date");

      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Calculate daily totals
  const dailyData = days.map((day) => {
    const dayTransactions = transactions?.filter((t) => {
      if (!t.due_date) return false;
      return format(parseISO(t.due_date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
    }) || [];

    const income = dayTransactions
      .filter((t) => t.type === "income" && t.status === "paid")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = dayTransactions
      .filter((t) => t.type === "expense" && t.status === "paid")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingIncome = dayTransactions
      .filter((t) => t.type === "income" && t.status === "pending")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingExpense = dayTransactions
      .filter((t) => t.type === "expense" && t.status === "pending")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      date: day,
      income,
      expense,
      pendingIncome,
      pendingExpense,
      balance: income - expense,
    };
  });

  // Calculate running balance
  let runningBalance = 0;
  const dailyWithBalance = dailyData.map((day) => {
    runningBalance += day.balance;
    return { ...day, runningBalance };
  });

  // Summary totals
  const totalIncome = dailyData.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = dailyData.reduce((sum, d) => sum + d.expense, 0);
  const totalPendingIncome = dailyData.reduce((sum, d) => sum + d.pendingIncome, 0);
  const totalPendingExpense = dailyData.reduce((sum, d) => sum + d.pendingExpense, 0);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleExport = (exportFormat: 'pdf' | 'excel') => {
    const exportData: CashFlowData[] = dailyWithBalance.map(d => ({
      date: d.date,
      income: d.income,
      expense: d.expense,
      pendingIncome: d.pendingIncome,
      pendingExpense: d.pendingExpense,
      balance: d.balance,
      runningBalance: d.runningBalance,
    }));
    
    exportCashFlow(
      "Clínica",
      format(currentDate, "MMMM yyyy", { locale: ptBR }),
      exportData,
      { income: totalIncome, expense: totalExpense, pendingIncome: totalPendingIncome, pendingExpense: totalPendingExpense },
      exportFormat
    );
  };

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Fluxo de Caixa</h3>
          <p className="text-sm text-muted-foreground">
            Visualize entradas e saídas diárias
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Button onClick={() => setNewEntryDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
          <FinancialExportButton
            onExportPDF={() => handleExport('pdf')}
            onExportExcel={() => handleExport('excel')}
            disabled={!transactions?.length}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[150px] text-center">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Entradas Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Saídas Realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpense)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              A Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(totalPendingIncome)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Saldo do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right text-emerald-600">Entradas</TableHead>
                  <TableHead className="text-right text-red-600">Saídas</TableHead>
                  <TableHead className="text-right">Saldo Dia</TableHead>
                  <TableHead className="text-right">Saldo Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyWithBalance.map((day) => {
                  const hasMovement = day.income > 0 || day.expense > 0 || day.pendingIncome > 0 || day.pendingExpense > 0;
                  const isToday = format(day.date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  
                  return (
                    <TableRow 
                      key={format(day.date, "yyyy-MM-dd")}
                      className={isToday ? "bg-primary/5" : ""}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {format(day.date, "dd/MM (EEE)", { locale: ptBR })}
                          {isToday && <Badge variant="outline" className="text-xs">Hoje</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {day.income > 0 && (
                          <span className="text-emerald-600 font-medium">
                            {formatCurrency(day.income)}
                          </span>
                        )}
                        {day.pendingIncome > 0 && (
                          <span className="text-amber-500 text-sm block">
                            +{formatCurrency(day.pendingIncome)} pendente
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {day.expense > 0 && (
                          <span className="text-red-600 font-medium">
                            {formatCurrency(day.expense)}
                          </span>
                        )}
                        {day.pendingExpense > 0 && (
                          <span className="text-amber-500 text-sm block">
                            -{formatCurrency(day.pendingExpense)} pendente
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        day.balance > 0 ? 'text-emerald-600' : day.balance < 0 ? 'text-red-600' : ''
                      }`}>
                        {hasMovement ? formatCurrency(day.balance) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        day.runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(day.runningBalance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <NewCashFlowEntryDialog
        open={newEntryDialogOpen}
        onOpenChange={setNewEntryDialogOpen}
        clinicId={clinicId}
      />
    </div>
  );
}
