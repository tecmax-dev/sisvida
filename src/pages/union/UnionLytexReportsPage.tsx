import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Receipt, AlertTriangle, Building2, TrendingUp, Calculator, FileText,
  Building, Trophy, Mail, History, ClipboardList, RefreshCw, CheckCircle, XCircle,
} from "lucide-react";
import { LytexReportFilters, LytexReportFiltersState } from "@/components/union/reports/LytexReportFilters";
import { LytexReportCard } from "@/components/union/reports/LytexReportCard";
import { LytexReportDataTable, Column } from "@/components/union/reports/LytexReportDataTable";
import * as LytexExports from "@/lib/lytexReportExportUtils";

export default function UnionLytexReportsPage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;
  const clinicName = currentClinic?.name || "Entidade Sindical";

  const [filters, setFilters] = useState<LytexReportFiltersState>({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    employerSearch: "",
    cnpjSearch: "",
    status: "all",
    grouping: "monthly",
  });

  const [activeReport, setActiveReport] = useState<string | null>(null);

  const periodLabel = useMemo(() => 
    `${format(filters.startDate, "dd/MM/yyyy")} a ${format(filters.endDate, "dd/MM/yyyy")}`,
    [filters.startDate, filters.endDate]
  );

  // Fetch contributions data
  const { data: contributions, isLoading } = useQuery({
    queryKey: ["lytex-reports-contributions", clinicId, filters.startDate, filters.endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employer_contributions")
        .select(`*, employers(id, name, cnpj), contribution_types(id, name)`)
        .eq("clinic_id", clinicId!)
        .gte("due_date", format(filters.startDate, "yyyy-MM-dd"))
        .lte("due_date", format(filters.endDate, "yyyy-MM-dd"))
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Process data for reports
  const reportData = useMemo(() => {
    if (!contributions) return null;

    const today = new Date();
    let filtered = contributions;

    if (filters.employerSearch) {
      filtered = filtered.filter(c => 
        c.employers?.name?.toLowerCase().includes(filters.employerSearch.toLowerCase())
      );
    }
    if (filters.cnpjSearch) {
      filtered = filtered.filter(c => c.employers?.cnpj?.includes(filters.cnpjSearch.replace(/\D/g, "")));
    }
    if (filters.status !== "all") {
      filtered = filtered.filter(c => c.status === filters.status);
    }

    const paid = filtered.filter(c => c.status === "paid");
    const pending = filtered.filter(c => c.status === "pending" || c.status === "overdue");
    const overdue = filtered.filter(c => c.status === "overdue");

    const formatCurrency = (cents: number) => 
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

    // Recebimentos
    const receivedPayments: LytexExports.ReceivedPayment[] = paid.map(c => ({
      id: c.id,
      employerName: c.employers?.name || "—",
      employerCnpj: c.employers?.cnpj || "",
      paidAt: c.paid_at || "",
      paidValue: c.paid_value || c.value,
      paymentMethod: c.payment_method || "Boleto",
      invoiceId: c.lytex_invoice_id || "",
      competence: `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`,
      contributionType: c.contribution_types?.name || "—",
      feeAmount: c.lytex_fee_amount || 0,
      netValue: c.net_value || (c.paid_value || c.value) - (c.lytex_fee_amount || 0),
    }));

    // Pendências
    const pendingContributions: LytexExports.PendingContribution[] = pending.map(c => ({
      id: c.id,
      employerName: c.employers?.name || "—",
      employerCnpj: c.employers?.cnpj || "",
      originalValue: c.value,
      updatedValue: c.value,
      dueDate: c.due_date,
      daysOverdue: c.due_date ? Math.max(0, differenceInDays(today, parseDateOnlyToLocalNoon(c.due_date))) : 0,
      status: c.status,
      competence: `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`,
      contributionType: c.contribution_types?.name || "—",
    }));

    // Pendências por empresa
    const employerMap = new Map<string, LytexExports.EmployerPendingSummary>();
    pending.forEach(c => {
      const key = c.employer_id;
      const existing = employerMap.get(key);
      const daysOver = c.due_date ? Math.max(0, differenceInDays(today, parseDateOnlyToLocalNoon(c.due_date))) : 0;
      if (existing) {
        existing.totalOpen += c.value;
        existing.pendingCount += 1;
        if (c.due_date && (!existing.oldestDueDate || c.due_date < existing.oldestDueDate)) {
          existing.oldestDueDate = c.due_date;
        }
        if (daysOver > existing.maxDaysOverdue) existing.maxDaysOverdue = daysOver;
      } else {
        employerMap.set(key, {
          employerId: key,
          employerName: c.employers?.name || "—",
          employerCnpj: c.employers?.cnpj || "",
          totalOpen: c.value,
          pendingCount: 1,
          oldestDueDate: c.due_date || "",
          maxDaysOverdue: daysOver,
        });
      }
    });

    // Adimplentes
    const paidEmployerMap = new Map<string, { name: string; cnpj: string; lastPayment: string; totalPaid: number }>();
    paid.forEach(c => {
      const existing = paidEmployerMap.get(c.employer_id);
      if (existing) {
        existing.totalPaid += c.paid_value || c.value;
        if (c.paid_at && c.paid_at > existing.lastPayment) existing.lastPayment = c.paid_at;
      } else {
        paidEmployerMap.set(c.employer_id, {
          name: c.employers?.name || "—",
          cnpj: c.employers?.cnpj || "",
          lastPayment: c.paid_at || "",
          totalPaid: c.paid_value || c.value,
        });
      }
    });

    const totals = {
      total: filtered.reduce((sum, c) => sum + c.value, 0),
      paid: paid.reduce((sum, c) => sum + (c.paid_value || c.value), 0),
      pending: pending.reduce((sum, c) => sum + c.value, 0),
      overdue: overdue.reduce((sum, c) => sum + c.value, 0),
      fees: paid.reduce((sum, c) => sum + (c.lytex_fee_amount || 0), 0),
      net: paid.reduce((sum, c) => sum + ((c.paid_value || c.value) - (c.lytex_fee_amount || 0)), 0),
    };

    return {
      receivedPayments,
      pendingContributions,
      pendingByEmployer: Array.from(employerMap.values()).sort((a, b) => b.totalOpen - a.totalOpen),
      compliantEmployers: Array.from(paidEmployerMap.values()).map(e => ({
        employerName: e.name, employerCnpj: e.cnpj, lastPayment: e.lastPayment, totalPaid: e.totalPaid
      })),
      defaulterEmployers: Array.from(employerMap.values())
        .filter(e => e.maxDaysOverdue > 0)
        .sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue)
        .map(e => ({
          employerName: e.employerName, employerCnpj: e.employerCnpj, totalOpen: e.totalOpen,
          maxDaysOverdue: e.maxDaysOverdue, oldestDebt: e.oldestDueDate
        })),
      totals,
      formatCurrency,
    };
  }, [contributions, filters]);

  const handleExport = (reportType: string, exportFormat: 'pdf' | 'excel') => {
    if (!reportData) return;
    
    try {
      switch (reportType) {
        case 'received':
          LytexExports.exportReceivedPayments(clinicName, periodLabel, reportData.receivedPayments,
            { total: reportData.totals.paid, fees: reportData.totals.fees, net: reportData.totals.net, count: reportData.receivedPayments.length }, exportFormat);
          break;
        case 'pending':
          LytexExports.exportPendingContributions(clinicName, periodLabel, reportData.pendingContributions,
            { totalOriginal: reportData.totals.pending, totalUpdated: reportData.totals.pending, count: reportData.pendingContributions.length }, exportFormat);
          break;
        case 'pending-employer':
          LytexExports.exportPendingByEmployer(clinicName, periodLabel, reportData.pendingByEmployer,
            { totalOpen: reportData.totals.pending, employerCount: reportData.pendingByEmployer.length, titleCount: reportData.pendingContributions.length }, exportFormat);
          break;
        case 'compliant':
          LytexExports.exportCompliantEmployers(clinicName, periodLabel, reportData.compliantEmployers,
            { count: reportData.compliantEmployers.length, totalPaid: reportData.totals.paid }, exportFormat);
          break;
        case 'defaulter':
          LytexExports.exportDefaulterEmployers(clinicName, periodLabel, reportData.defaulterEmployers,
            { count: reportData.defaulterEmployers.length, totalOpen: reportData.totals.overdue }, exportFormat);
          break;
      }
      toast.success(`Relatório exportado com sucesso!`);
    } catch (error) {
      toast.error("Erro ao exportar relatório");
    }
  };

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios Lytex</h1>
        <p className="text-muted-foreground">Relatórios financeiros e administrativos da conciliação</p>
      </div>

      <LytexReportFilters filters={filters} onFiltersChange={setFilters} showGrouping showContributionType />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="received">Recebimentos</TabsTrigger>
            <TabsTrigger value="pending">Pendências</TabsTrigger>
            <TabsTrigger value="status">Situação</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Total Faturado</p>
                <p className="text-2xl font-bold">{reportData?.formatCurrency(reportData.totals.total)}</p>
              </CardContent></Card>
              <Card className="border-emerald-200 bg-emerald-50/30"><CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Total Recebido</p>
                <p className="text-2xl font-bold text-emerald-600">{reportData?.formatCurrency(reportData.totals.paid)}</p>
              </CardContent></Card>
              <Card className="border-amber-200 bg-amber-50/30"><CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-2xl font-bold text-amber-600">{reportData?.formatCurrency(reportData.totals.pending)}</p>
              </CardContent></Card>
              <Card className="border-rose-200 bg-rose-50/30"><CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Vencido</p>
                <p className="text-2xl font-bold text-rose-600">{reportData?.formatCurrency(reportData.totals.overdue)}</p>
              </CardContent></Card>
            </div>

            {/* Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <LytexReportCard title="Recebimentos" description="Pagamentos recebidos no período" icon={<Receipt className="h-5 w-5" />}
                color="bg-emerald-500" count={reportData?.receivedPayments.length} value={reportData?.formatCurrency(reportData.totals.paid)}
                onExportPDF={() => handleExport('received', 'pdf')} onExportExcel={() => handleExport('received', 'excel')} />
              <LytexReportCard title="Pendências" description="Títulos em aberto" icon={<AlertTriangle className="h-5 w-5" />}
                color="bg-amber-500" count={reportData?.pendingContributions.length} value={reportData?.formatCurrency(reportData.totals.pending)}
                onExportPDF={() => handleExport('pending', 'pdf')} onExportExcel={() => handleExport('pending', 'excel')} />
              <LytexReportCard title="Pendências por Empresa" description="Agrupado por empresa" icon={<Building2 className="h-5 w-5" />}
                color="bg-blue-500" count={reportData?.pendingByEmployer.length}
                onExportPDF={() => handleExport('pending-employer', 'pdf')} onExportExcel={() => handleExport('pending-employer', 'excel')} />
              <LytexReportCard title="Adimplentes" description="Empresas em dia" icon={<CheckCircle className="h-5 w-5" />}
                color="bg-teal-500" count={reportData?.compliantEmployers.length}
                onExportPDF={() => handleExport('compliant', 'pdf')} onExportExcel={() => handleExport('compliant', 'excel')} />
              <LytexReportCard title="Inadimplentes" description="Empresas em atraso" icon={<XCircle className="h-5 w-5" />}
                color="bg-rose-500" count={reportData?.defaulterEmployers.length}
                onExportPDF={() => handleExport('defaulter', 'pdf')} onExportExcel={() => handleExport('defaulter', 'excel')} />
            </div>
          </TabsContent>

          <TabsContent value="received">
            {reportData && (
              <LytexReportDataTable
                title="Recebimentos"
                data={reportData.receivedPayments}
                keyField="id"
                searchFields={["employerName", "employerCnpj"]}
                columns={[
                  { key: "employerName", header: "Empresa", sortable: true },
                  { key: "competence", header: "Competência" },
                  { key: "paidAt", header: "Data Pgto", render: (r) => r.paidAt ? format(new Date(r.paidAt), "dd/MM/yyyy") : "—", sortable: true },
                  { key: "paidValue", header: "Valor", render: (r) => reportData.formatCurrency(r.paidValue), align: "right", sortable: true },
                  { key: "feeAmount", header: "Taxa", render: (r) => reportData.formatCurrency(r.feeAmount || 0), align: "right" },
                  { key: "netValue", header: "Líquido", render: (r) => reportData.formatCurrency(r.netValue || r.paidValue), align: "right" },
                ]}
                onExportPDF={() => handleExport('received', 'pdf')}
                onExportExcel={() => handleExport('received', 'excel')}
              />
            )}
          </TabsContent>

          <TabsContent value="pending">
            {reportData && (
              <LytexReportDataTable
                title="Pendências"
                data={reportData.pendingContributions}
                keyField="id"
                searchFields={["employerName", "employerCnpj"]}
                columns={[
                  { key: "employerName", header: "Empresa", sortable: true },
                  { key: "competence", header: "Competência" },
                  { key: "dueDate", header: "Vencimento", render: (r) => format(new Date(r.dueDate), "dd/MM/yyyy"), sortable: true },
                  { key: "originalValue", header: "Valor", render: (r) => reportData.formatCurrency(r.originalValue), align: "right", sortable: true },
                  { key: "daysOverdue", header: "Dias Atraso", render: (r) => r.daysOverdue > 0 ? `${r.daysOverdue} dias` : "—", align: "center", sortable: true },
                  { key: "status", header: "Status", render: (r) => r.status === "overdue" ? <span className="text-rose-600 font-medium">Vencido</span> : <span className="text-amber-600">Pendente</span> },
                ]}
                onExportPDF={() => handleExport('pending', 'pdf')}
                onExportExcel={() => handleExport('pending', 'excel')}
              />
            )}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            {reportData && (
              <>
                <LytexReportDataTable
                  title="Empresas Adimplentes"
                  data={reportData.compliantEmployers}
                  keyField="employerCnpj"
                  searchFields={["employerName", "employerCnpj"]}
                  columns={[
                    { key: "employerName", header: "Empresa", sortable: true },
                    { key: "employerCnpj", header: "CNPJ" },
                    { key: "lastPayment", header: "Último Pagamento", render: (r) => r.lastPayment ? format(new Date(r.lastPayment), "dd/MM/yyyy") : "—", sortable: true },
                    { key: "totalPaid", header: "Total Pago", render: (r) => reportData.formatCurrency(r.totalPaid), align: "right", sortable: true },
                  ]}
                  onExportPDF={() => handleExport('compliant', 'pdf')}
                  onExportExcel={() => handleExport('compliant', 'excel')}
                  maxHeight="300px"
                />
                <LytexReportDataTable
                  title="Empresas Inadimplentes"
                  data={reportData.defaulterEmployers}
                  keyField="employerCnpj"
                  searchFields={["employerName", "employerCnpj"]}
                  columns={[
                    { key: "employerName", header: "Empresa", sortable: true },
                    { key: "employerCnpj", header: "CNPJ" },
                    { key: "totalOpen", header: "Total Aberto", render: (r) => reportData.formatCurrency(r.totalOpen), align: "right", sortable: true },
                    { key: "maxDaysOverdue", header: "Maior Atraso", render: (r) => `${r.maxDaysOverdue} dias`, align: "center", sortable: true },
                  ]}
                  onExportPDF={() => handleExport('defaulter', 'pdf')}
                  onExportExcel={() => handleExport('defaulter', 'excel')}
                  maxHeight="300px"
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
