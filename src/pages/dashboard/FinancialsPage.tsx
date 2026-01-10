import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { FeatureGate } from "@/components/features/FeatureGate";
import { FinancialMetrics } from "@/components/financials/FinancialMetrics";
import { FinancialCharts } from "@/components/financials/FinancialCharts";
import { TransactionTable } from "@/components/financials/TransactionTable";
import { TransactionDialog } from "@/components/financials/TransactionDialog";
import { CategoryDialog } from "@/components/financials/CategoryDialog";
import { CashRegistersPanel } from "@/components/financials/CashRegistersPanel";
import { CashFlowPanel } from "@/components/financials/CashFlowPanel";
import { ReceivablesPanel } from "@/components/financials/ReceivablesPanel";
import { TransfersPanel } from "@/components/financials/TransfersPanel";
import { RecurringPanel } from "@/components/financials/RecurringPanel";
import { CommissionsPanel } from "@/components/financials/CommissionsPanel";
import { ReconciliationPanel } from "@/components/financials/ReconciliationPanel";
import { ChartOfAccountsPanel } from "@/components/financials/ChartOfAccountsPanel";
import { CostCentersPanel } from "@/components/financials/CostCentersPanel";
import { ExpensesListPanel } from "@/components/financials/ExpensesListPanel";
import { SuppliersPanel } from "@/components/financials/SuppliersPanel";
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
  LayoutDashboard
} from "lucide-react";

type SubTab = 
  | "cashflow" | "income" | "expense" 
  | "registers" | "transfers" | "receivables" | "reconciliation"
  | "recurring" | "commissions"
  | "accounts" | "costcenters" | "expenses" | "suppliers";

function FinancialsContent() {
  const { currentClinic } = useAuth();
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [subTab, setSubTab] = useState<SubTab>("cashflow");

  if (!currentClinic) {
    return null;
  }

  const subNavConfig: Record<string, { label: string; value: SubTab; icon: React.ElementType }[]> = {
    movements: [
      { label: "Fluxo de Caixa", value: "cashflow", icon: Wallet },
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
      { label: "Fornecedores", value: "suppliers", icon: Truck },
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
            <Button size="sm" onClick={() => setTransactionDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <Card className="border-0 shadow-sm bg-muted/30">
            <CardContent className="p-2">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto bg-transparent">
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
        </Tabs>

        <TransactionDialog
          open={transactionDialogOpen}
          onOpenChange={setTransactionDialogOpen}
          clinicId={currentClinic.id}
        />

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
