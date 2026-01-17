import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionFinancialData } from "@/hooks/useUnionFinancialData";
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
import { format, parseISO, startOfMonth, endOfMonth, subDays, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Download, Building2, Calendar as CalendarIcon, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: string;
  amount: number;
  status: string;
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

export function UnionStatementPanel() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;

  const [cashRegisterId, setCashRegisterId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => endOfMonth(new Date()));
  const [isMigrating, setIsMigrating] = useState(false);

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

  // Fetch transactions for the period and cash register
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["union-statement-transactions", clinicId, cashRegisterId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_transactions")
        .select("id, paid_date, due_date, description, type, amount, status")
        .eq("clinic_id", clinicId!)
        .eq("cash_register_id", cashRegisterId)
        .eq("status", "paid")
        .gte("paid_date", format(startDate, "yyyy-MM-dd"))
        .lte("paid_date", format(endDate, "yyyy-MM-dd"))
        .order("paid_date")
        .order("created_at");

      if (error) throw error;
      return data.map((t) => ({
        id: t.id,
        date: t.paid_date || t.due_date || "",
        description: t.description || "Sem descrição",
        type: t.type,
        amount: Number(t.amount) || 0,
        status: t.status,
      }));
    },
    enabled: !!clinicId && !!cashRegisterId,
  });

  // Calculate initial balance (saldo anterior)
  const { data: previousBalance } = useQuery({
    queryKey: ["union-statement-previous-balance", clinicId, cashRegisterId, startDate, selectedRegister?.id],
    queryFn: async () => {
      // Base balance comes from the register initial balance, but only if startDate is AFTER the initial balance date.
      // This prevents double-counting historical transactions that happened before the initial balance snapshot.
      const initialBalanceDate = (selectedRegister as any)?.initial_balance_date as string | null | undefined;
      const initialBalanceValue = Number((selectedRegister as any)?.initial_balance) || 0;

      const startDateOnly = format(startDate, "yyyy-MM-dd");

      let base = 0;
      let lowerBoundDate: string | undefined;

      if (initialBalanceDate) {
        const initDateLocalNoon = parseDateOnlyToLocalNoon(initialBalanceDate);
        if (startDate.getTime() > initDateLocalNoon.getTime()) {
          base = initialBalanceValue;
          // Only sum transactions strictly AFTER the initial balance date to avoid double count.
          lowerBoundDate = initialBalanceDate;
        }
      }

      // Get paid transactions before startDate for this register
      let query = supabase
        .from("union_financial_transactions")
        .select("type, amount, paid_date")
        .eq("clinic_id", clinicId!)
        .eq("cash_register_id", cashRegisterId)
        .eq("status", "paid")
        .lt("paid_date", startDateOnly);

      if (lowerBoundDate) {
        query = query.gt("paid_date", lowerBoundDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Sum (income - expense)
      let delta = 0;
      data?.forEach((t) => {
        const amount = Number((t as any).amount) || 0;
        if ((t as any).type === "income") {
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
          date: parseISO(dateStr),
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
    if (!dailyGroups.length || !summary || !selectedRegister) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // Header
    if (currentClinic?.logo_url) {
      try {
        doc.addImage(currentClinic.logo_url, "PNG", 14, 10, 30, 30);
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
    const prevBalanceDate = subDays(startDate, 1);
    autoTable(doc, {
      startY: yPos,
      head: [["DATA", "SALDO ANTERIOR"]],
      body: [[format(prevBalanceDate, "dd/MM/yyyy"), formatCurrency(summary.initialBalance)]],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], fontStyle: "bold" },
      styles: { fontSize: 9 },
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
          t.type === "expense" ? formatCurrency(t.amount) : "",
          t.type === "income" ? formatCurrency(t.amount) : "",
          formatCurrency((t as any).lineBalance),
        ]);
      });

      // Daily subtotal row
      tableBody.push([
        {
          content: `Total do dia ${format(group.date, "dd/MM/yyyy")}: Débito: ${formatCurrency(-group.totalDebit)} - Crédito: ${formatCurrency(group.totalCredit)} - Saldo: ${formatCurrency(group.endDayBalance)}`,
          colSpan: 5,
          styles: { fontStyle: "bold", fillColor: [241, 245, 249], fontSize: 8 },
        },
      ]);
    });

    autoTable(doc, {
      startY: yPos,
      head: [["DATA", "DESCRIÇÃO", "DÉBITO", "CRÉDITO", "SALDO"]],
      body: tableBody,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], fontStyle: "bold" },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 80 },
        2: { cellWidth: 25, halign: "right" },
        3: { cellWidth: 25, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
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
      headStyles: { fillColor: [16, 185, 129], fontStyle: "bold" },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
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
    if (!dailyGroups.length || !summary || !selectedRegister) return;

    const wsData: any[] = [];

    // Header info
    wsData.push([currentClinic?.name || "Entidade Sindical"]);
    wsData.push([currentClinic?.cnpj || ""]);
    wsData.push(["MOVIMENTAÇÃO E SALDO"]);
    wsData.push([`Portador: ${selectedRegister.name} - Período: De ${format(startDate, "dd/MM/yyyy")} até ${format(endDate, "dd/MM/yyyy")}`]);
    wsData.push([]);

    // Previous balance
    wsData.push(["DATA", "SALDO ANTERIOR"]);
    wsData.push([format(subDays(startDate, 1), "dd/MM/yyyy"), summary.initialBalance]);
    wsData.push([]);

    // Transactions header
    wsData.push(["DATA", "DESCRIÇÃO", "DÉBITO", "CRÉDITO", "SALDO"]);

    dailyGroups.forEach((group) => {
      group.transactions.forEach((t) => {
        wsData.push([
          format(group.date, "dd/MM/yyyy"),
          t.description.toUpperCase(),
          t.type === "expense" ? t.amount : "",
          t.type === "income" ? t.amount : "",
          (t as any).lineBalance,
        ]);
      });

      // Daily subtotal
      wsData.push([
        `Total do dia ${format(group.date, "dd/MM/yyyy")}`,
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Movimentação e Saldo</h1>
        <p className="text-muted-foreground">
          Extrato detalhado de movimentações por portador
        </p>
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
      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6">
            {/* Row 1: Portador selector - full width */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Portador Bancário</Label>
              <Select value={cashRegisterId} onValueChange={setCashRegisterId}>
                <SelectTrigger className="w-full md:max-w-md h-11 bg-background">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Selecione o portador" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
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
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              {/* Date filters group */}
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-[180px] justify-start text-left font-normal h-11 bg-background",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border z-50" align="start" sideOffset={4}>
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

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full sm:w-[180px] justify-start text-left font-normal h-11 bg-background",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {endDate ? format(endDate, "dd/MM/yyyy") : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border z-50" align="start" sideOffset={4}>
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

              {/* Export buttons */}
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={handleExportPDF}
                  disabled={!dailyGroups.length}
                  className="flex-1 sm:flex-none h-11"
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  disabled={!dailyGroups.length}
                  className="flex-1 sm:flex-none h-11"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
          {/* Previous Balance */}
          {summary && (
            <Card>
              <CardContent className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-500/10">
                      <TableHead className="font-bold">DATA</TableHead>
                      <TableHead className="text-right font-bold">SALDO ANTERIOR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{format(subDays(startDate, 1), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(summary.initialBalance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Transactions Table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="bg-blue-500/10">
                      <TableHead className="font-bold w-[100px]">DATA</TableHead>
                      <TableHead className="font-bold">DESCRIÇÃO</TableHead>
                      <TableHead className="text-right font-bold text-red-600 w-[120px]">DÉBITO</TableHead>
                      <TableHead className="text-right font-bold text-emerald-600 w-[120px]">CRÉDITO</TableHead>
                      <TableHead className="text-right font-bold w-[140px]">SALDO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyGroups.map((group) => (
                      <>
                        {group.transactions.map((t, idx) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">
                              {idx === 0 ? format(group.date, "dd/MM/yyyy") : ""}
                            </TableCell>
                            <TableCell className="uppercase text-sm">{t.description}</TableCell>
                            <TableCell className="text-right text-red-600">
                              {t.type === "expense" ? formatCurrency(t.amount) : ""}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600">
                              {t.type === "income" ? formatCurrency(t.amount) : ""}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency((t as any).lineBalance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Daily subtotal */}
                        <TableRow className="bg-muted/50 border-b-2">
                          <TableCell colSpan={5} className="font-bold text-sm py-2">
                            Total do dia {format(group.date, "dd/MM/yyyy")}:{" "}
                            <span className="text-red-600">Débito: {formatCurrency(-group.totalDebit)}</span>
                            {" - "}
                            <span className="text-emerald-600">Crédito: {formatCurrency(group.totalCredit)}</span>
                            {" - "}
                            Saldo: {formatCurrency(group.endDayBalance)}
                          </TableCell>
                        </TableRow>
                      </>
                    ))}

                    {dailyGroups.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          Nenhuma movimentação encontrada no período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {summary && dailyGroups.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-500/10">
                      <TableHead className="font-bold text-center">REGISTROS</TableHead>
                      <TableHead className="font-bold text-right">TOTAL INICIAL</TableHead>
                      <TableHead className="font-bold text-right text-red-600">TOTAL DÉBITOS</TableHead>
                      <TableHead className="font-bold text-right text-emerald-600">TOTAL CRÉDITO</TableHead>
                      <TableHead className="font-bold text-right">TOTAL FINAL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-center font-bold">{summary.totalRecords}</TableCell>
                      <TableCell className="text-right">{formatCurrency(summary.initialBalance)}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(summary.totalDebits)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatCurrency(summary.totalCredits)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(summary.finalBalance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
