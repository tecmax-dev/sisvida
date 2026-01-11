import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { FeatureGate } from "@/components/features/FeatureGate";
import { FinancialMetrics } from "@/components/financials/FinancialMetrics";
import { FinancialCharts } from "@/components/financials/FinancialCharts";
import { TransactionTable } from "@/components/financials/TransactionTable";
import { CategoryDialog } from "@/components/financials/CategoryDialog";
import { CashRegistersPanel } from "@/components/financials/CashRegistersPanel";
import { CashFlowPanel } from "@/components/financials/CashFlowPanel";
import { CashFlowAnnualView } from "@/components/financials/CashFlowAnnualView";
import { CashRegisterBalancesPanel } from "@/components/financials/CashRegisterBalancesPanel";
import { ReceivablesPanel } from "@/components/financials/ReceivablesPanel";
import { TransfersPanel } from "@/components/financials/TransfersPanel";
import { RecurringPanel } from "@/components/financials/RecurringPanel";
import { CommissionsPanel } from "@/components/financials/CommissionsPanel";
import { ReconciliationPanel } from "@/components/financials/ReconciliationPanel";
import { ChartOfAccountsPanel } from "@/components/financials/ChartOfAccountsPanel";
import { CostCentersPanel } from "@/components/financials/CostCentersPanel";
import { ExpensesListPanel } from "@/components/financials/ExpensesListPanel";
import { SuppliersPanel } from "@/components/financials/SuppliersPanel";
import { SupplierExpensesPanel } from "@/components/financials/SupplierExpensesPanel";
import { FinancialReportsTab } from "@/components/financials/FinancialReportsTab";
import { FinancialAuditPanel } from "@/components/financials/FinancialAuditPanel";
import { InstitutionalReportsPanel } from "@/components/financials/InstitutionalReportsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Settings2, 
  Wallet, 
  TrendingUp, 
  ArrowDownCircle, 
  ArrowUpCircle,
  ArrowLeftRight,
  Receipt,
  FileCheck,
  RefreshCw,
  Users,
  FolderTree,
  Building2,
  Truck,
  ClipboardList,
  LayoutDashboard,
  FileText,
  BarChart3,
  Shield,
  FileStack
} from "lucide-react";

type SubTab = 
  | "cashflow" | "cashflow-annual" | "balances" | "income" | "expense" 
  | "registers" | "transfers" | "receivables" | "reconciliation"
  | "recurring" | "commissions"
  | "accounts" | "costcenters" | "expenses" | "suppliers" | "supplier-expenses"
  | "audit" | "institutional";

function FinancialsContent() {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [subTab, setSubTab] = useState<SubTab>("cashflow");

  if (!currentClinic) {
    return null;
  }

  const subNavConfig: Record<string, { label: string; value: SubTab; icon: React.ElementType }[]> = {
    movements: [
      { label: "Fluxo Mensal", value: "cashflow", icon: Wallet },
      { label: "Fluxo Anual", value: "cashflow-annual", icon: BarChart3 },
      { label: "Saldos", value: "balances", icon: TrendingUp },
      { label: "Receber", value: "income", icon: ArrowDownCircle },
      { label: "Pagar", value: "expense", icon: ArrowUpCircle },
    ],
    management: [
      { label: "Caixas", value: "registers", icon: Wallet },
      { label: "Transferências", value: "transfers", icon: ArrowLeftRight },
      { label: "Recebíveis", value: "receivables", icon: Receipt },
      { label: "Conciliação", value: "reconciliation", icon: FileCheck },
    ],
    recurring: [
      { label: "Recorrências", value: "recurring", icon: RefreshCw },
      { label: "Comissões", value: "commissions", icon: Users },
    ],
    registry: [
      { label: "Plano de Contas", value: "accounts", icon: FolderTree },
      { label: "Centros de Custo", value: "costcenters", icon: Building2 },
      { label: "Despesas", value: "expenses", icon: ClipboardList },
      { label: "Por Fornecedor", value: "supplier-expenses", icon: BarChart3 },
      { label: "Fornecedores", value: "suppliers", icon: Truck },
    ],
    reports: [
      { label: "Operacionais", value: "cashflow", icon: BarChart3 },
      { label: "Institucionais", value: "institutional", icon: FileStack },
      { label: "Auditoria", value: "audit", icon: Shield },
    ],
  };

  const renderSubNav = (category: string) => {
    const items = subNavConfig[category];
    if (!items) return null;

    return (
      <div className="flex flex-wrap gap-2 mb-6">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = subTab === item.value;
          return (
            <Button
              key={item.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setSubTab(item.value)}
              className={`gap-2 ${isActive ? "" : "bg-card hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </div>
    );
  };

  const renderSubContent = (category: string) => {
    const contentMap: Record<SubTab, React.ReactNode> = {
      cashflow: <CashFlowPanel clinicId={currentClinic.id} />,
      "cashflow-annual": <CashFlowAnnualView clinicId={currentClinic.id} />,
      balances: <CashRegisterBalancesPanel clinicId={currentClinic.id} />,
      income: <TransactionTable clinicId={currentClinic.id} filterType="income" />,
      expense: <TransactionTable clinicId={currentClinic.id} filterType="expense" />,
      registers: <CashRegistersPanel clinicId={currentClinic.id} />,
      transfers: <TransfersPanel clinicId={currentClinic.id} />,
      receivables: <ReceivablesPanel clinicId={currentClinic.id} />,
      reconciliation: <ReconciliationPanel clinicId={currentClinic.id} />,
      recurring: <RecurringPanel clinicId={currentClinic.id} />,
      commissions: <CommissionsPanel clinicId={currentClinic.id} />,
      accounts: <ChartOfAccountsPanel clinicId={currentClinic.id} />,
      costcenters: <CostCentersPanel clinicId={currentClinic.id} />,
      expenses: <ExpensesListPanel clinicId={currentClinic.id} />,
      suppliers: <SuppliersPanel clinicId={currentClinic.id} />,
      "supplier-expenses": <SupplierExpensesPanel clinicId={currentClinic.id} />,
      audit: <FinancialAuditPanel clinicId={currentClinic.id} />,
      institutional: <InstitutionalReportsPanel clinicId={currentClinic.id} />,
    };

    const items = subNavConfig[category];
    if (!items) return null;

    // Check if current subTab belongs to this category
    const belongsToCategory = items.some(item => item.value === subTab);
    const activeSubTab = belongsToCategory ? subTab : items[0].value;

    return contentMap[activeSubTab];
  };

  // Reset subTab when changing main tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const defaultSubTabs: Record<string, SubTab> = {
      movements: "cashflow",
      management: "registers",
      recurring: "recurring",
      registry: "accounts",
      reports: "cashflow",
    };
    if (defaultSubTabs[value]) {
      setSubTab(defaultSubTabs[value]);
    }
  };

  return (
    <RoleGuard permission="view_financials">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie receitas, despesas e fluxo de caixa
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCategoryDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Categorias
            </Button>
            <Button size="sm" onClick={() => navigate("/dashboard/financials/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <Card className="border-0 shadow-sm bg-muted/30">
            <CardContent className="p-2">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 h-auto bg-transparent">
                <TabsTrigger 
                  value="overview" 
                  className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Visão Geral</span>
                  <span className="sm:hidden">Geral</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="movements" 
                  className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Movimentações</span>
                  <span className="sm:hidden">Movim.</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="management" 
                  className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Gestão</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="recurring" 
                  className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Recorrências</span>
                  <span className="sm:hidden">Recor.</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="registry" 
                  className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <FolderTree className="h-4 w-4" />
                  <span>Cadastros</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="reports" 
                  className="gap-2 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4" />
                  <span>Relatórios</span>
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          {/* Visão Geral */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            <FinancialMetrics clinicId={currentClinic.id} />
            <FinancialCharts clinicId={currentClinic.id} />
            <TransactionTable clinicId={currentClinic.id} />
          </TabsContent>

          {/* Movimentações */}
          <TabsContent value="movements" className="mt-0">
            {renderSubNav("movements")}
            {renderSubContent("movements")}
          </TabsContent>

          {/* Gestão */}
          <TabsContent value="management" className="mt-0">
            {renderSubNav("management")}
            {renderSubContent("management")}
          </TabsContent>

          {/* Recorrências */}
          <TabsContent value="recurring" className="mt-0">
            {renderSubNav("recurring")}
            {renderSubContent("recurring")}
          </TabsContent>

          {/* Cadastros */}
          <TabsContent value="registry" className="mt-0">
            {renderSubNav("registry")}
            {renderSubContent("registry")}
          </TabsContent>

          {/* Relatórios */}
          <TabsContent value="reports" className="mt-0">
            {renderSubNav("reports")}
            {subTab === "cashflow" && <FinancialReportsTab clinicId={currentClinic.id} />}
            {subTab === "institutional" && <InstitutionalReportsPanel clinicId={currentClinic.id} />}
            {subTab === "audit" && <FinancialAuditPanel clinicId={currentClinic.id} />}
          </TabsContent>
        </Tabs>


        <CategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          clinicId={currentClinic.id}
        />
      </div>
    </RoleGuard>
  );
}

export default function FinancialsPage() {
  return (
    <FeatureGate feature="financial_management" showUpgradePrompt>
      <FinancialsContent />
    </FeatureGate>
  );
}
