import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  FileText, 
  Download, 
  Building2, 
  Users, 
  Gavel,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
  FileCheck
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InstitutionalReportsPanelProps {
  clinicId: string;
}

type ReportType = "prestacao_contas" | "diretoria" | "assembleia" | "auditoria";

export function InstitutionalReportsPanel({ clinicId }: InstitutionalReportsPanelProps) {
  const [reportType, setReportType] = useState<ReportType>("prestacao_contas");
  const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  // Fetch clinic info
  const { data: clinic } = useQuery({
    queryKey: ["clinic-info", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", clinicId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch financial transactions for period
  const { data: transactions } = useQuery({
    queryKey: ["institutional-report-transactions", clinicId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          financial_categories (name, color, type),
          suppliers (name, cnpj)
        `)
        .eq("clinic_id", clinicId)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch contributions for period
  const { data: contributions } = useQuery({
    queryKey: ["institutional-report-contributions", clinicId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          employers (name, cnpj),
          contribution_types (name)
        `)
        .eq("clinic_id", clinicId)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!transactions) return null;

    const income = transactions.filter(t => t.type === "income");
    const expenses = transactions.filter(t => t.type === "expense");

    const totalIncome = income.reduce((sum, t) => sum + (t.amount || 0), 0);
    const paidIncome = income.filter(t => t.status === "paid").reduce((sum, t) => sum + (t.amount || 0), 0);
    const pendingIncome = income.filter(t => t.status === "pending").reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = expenses.reduce((sum, t) => sum + (t.amount || 0), 0);
    const paidExpense = expenses.filter(t => t.status === "paid").reduce((sum, t) => sum + (t.amount || 0), 0);
    const pendingExpense = expenses.filter(t => t.status === "pending").reduce((sum, t) => sum + (t.amount || 0), 0);

    // Group by category
    const incomeByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};

    income.forEach(t => {
      const cat = t.financial_categories?.name || "Sem categoria";
      incomeByCategory[cat] = (incomeByCategory[cat] || 0) + (t.amount || 0);
    });

    expenses.forEach(t => {
      const cat = t.financial_categories?.name || "Sem categoria";
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (t.amount || 0);
    });

    return {
      totalIncome,
      paidIncome,
      pendingIncome,
      totalExpense,
      paidExpense,
      pendingExpense,
      balance: totalIncome - totalExpense,
      paidBalance: paidIncome - paidExpense,
      incomeByCategory,
      expenseByCategory,
      transactionCount: transactions.length,
      contributionCount: contributions?.length || 0,
      contributionTotal: contributions?.reduce((sum, c) => sum + (c.value || 0) / 100, 0) || 0,
      contributionPaid: contributions?.filter(c => c.status === "paid").reduce((sum, c) => sum + (c.value || 0) / 100, 0) || 0,
    };
  }, [transactions, contributions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const generatePDF = () => {
    if (!summary || !clinic) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header with logo space
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(clinic.name || "Sindicato", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const reportTitles: Record<ReportType, string> = {
      prestacao_contas: "PRESTAÇÃO DE CONTAS",
      diretoria: "RELATÓRIO PARA DIRETORIA",
      assembleia: "RELATÓRIO PARA ASSEMBLEIA GERAL",
      auditoria: "RELATÓRIO DE AUDITORIA FINANCEIRA",
    };
    doc.text(reportTitles[reportType], 14, 28);
    doc.text(`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`, 14, 35);

    // Date generated
    doc.setFontSize(8);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - 14, 35, { align: "right" });

    let yPos = 50;

    // Summary Cards
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO FINANCEIRO", 14, yPos);
    yPos += 10;

    // Create summary table
    autoTable(doc, {
      startY: yPos,
      head: [["Descrição", "Valor"]],
      body: [
        ["Total de Receitas", formatCurrency(summary.totalIncome)],
        ["Receitas Recebidas", formatCurrency(summary.paidIncome)],
        ["Receitas Pendentes", formatCurrency(summary.pendingIncome)],
        ["Total de Despesas", formatCurrency(summary.totalExpense)],
        ["Despesas Pagas", formatCurrency(summary.paidExpense)],
        ["Despesas Pendentes", formatCurrency(summary.pendingExpense)],
        ["Saldo do Período", formatCurrency(summary.balance)],
        ["Saldo Realizado", formatCurrency(summary.paidBalance)],
      ],
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Contributions Summary
    if (contributions && contributions.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("CONTRIBUIÇÕES SINDICAIS", 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [["Descrição", "Valor"]],
        body: [
          ["Total de Contribuições", formatCurrency(summary.contributionTotal)],
          ["Contribuições Recebidas", formatCurrency(summary.contributionPaid)],
          ["Contribuições Pendentes", formatCurrency(summary.contributionTotal - summary.contributionPaid)],
          ["Número de Lançamentos", summary.contributionCount.toString()],
        ],
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 9 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Income by Category
    const incomeCategories = Object.entries(summary.incomeByCategory);
    if (incomeCategories.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("RECEITAS POR CATEGORIA", 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [["Categoria", "Valor", "%"]],
        body: incomeCategories.map(([cat, value]) => [
          cat,
          formatCurrency(value),
          ((value / summary.totalIncome) * 100).toFixed(1) + "%"
        ]),
        theme: "striped",
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 9 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Expense by Category
    const expenseCategories = Object.entries(summary.expenseByCategory);
    if (expenseCategories.length > 0) {
      // Check if need new page
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DESPESAS POR CATEGORIA", 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [["Categoria", "Valor", "%"]],
        body: expenseCategories.map(([cat, value]) => [
          cat,
          formatCurrency(value),
          ((value / summary.totalExpense) * 100).toFixed(1) + "%"
        ]),
        theme: "striped",
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 9 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Página ${i} de ${pageCount} - ${clinic.name}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Save
    const filename = `relatorio_${reportType}_${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(filename);
  };

  const reportTypes = [
    { value: "prestacao_contas", label: "Prestação de Contas", icon: FileCheck, description: "Relatório completo para prestação de contas" },
    { value: "diretoria", label: "Diretoria", icon: Building2, description: "Resumo executivo para a diretoria" },
    { value: "assembleia", label: "Assembleia", icon: Users, description: "Relatório para assembleia geral" },
    { value: "auditoria", label: "Auditoria", icon: Gavel, description: "Relatório detalhado para auditoria" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Relatórios Institucionais</CardTitle>
                <CardDescription>
                  Relatórios para prestação de contas, diretoria e assembleias
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Report Type Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          const isActive = reportType === type.value;
          return (
            <Card 
              key={type.value}
              className={`cursor-pointer transition-all ${
                isActive 
                  ? "ring-2 ring-primary bg-primary/5" 
                  : "hover:bg-muted/50"
              }`}
              onClick={() => setReportType(type.value as ReportType)}
            >
              <CardContent className="pt-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <Icon className={`h-8 w-8 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <p className={`font-medium ${isActive ? "text-primary" : ""}`}>{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-1 block">Data Inicial</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground mb-1 block">Data Final</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={generatePDF} className="gap-2">
              <Download className="h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Preview */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-green-50 dark:bg-green-900/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Receitas</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(summary.totalIncome)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Despesas</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(summary.totalExpense)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={summary.balance >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-orange-50 dark:bg-orange-900/20"}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Wallet className={`h-5 w-5 ${summary.balance >= 0 ? "text-emerald-600" : "text-orange-600"}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className={`text-xl font-bold ${summary.balance >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                    {formatCurrency(summary.balance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Contribuições</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency(summary.contributionTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Breakdown */}
      {summary && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4 text-green-600" />
                Receitas por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(summary.incomeByCategory).map(([cat, value]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm">{cat}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-50">
                        {((value / summary.totalIncome) * 100).toFixed(1)}%
                      </Badge>
                      <span className="font-mono text-sm">{formatCurrency(value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4 text-red-600" />
                Despesas por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(summary.expenseByCategory).map(([cat, value]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm">{cat}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-red-50">
                        {((value / summary.totalExpense) * 100).toFixed(1)}%
                      </Badge>
                      <span className="font-mono text-sm">{formatCurrency(value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
