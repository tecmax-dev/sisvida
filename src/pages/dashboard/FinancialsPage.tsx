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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  Users
} from "lucide-react";

function FinancialsContent() {
  const { currentClinic } = useAuth();
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  if (!currentClinic) {
    return null;
  }

  return (
    <RoleGuard permission="view_financials">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
            <p className="text-muted-foreground">
              Gerencie receitas, despesas e fluxo de caixa da clínica
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Categorias
            </Button>
            <Button onClick={() => setTransactionDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-auto min-w-full md:min-w-0">
              <TabsTrigger value="overview" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger value="cashflow" className="gap-2">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Fluxo de Caixa</span>
              </TabsTrigger>
              <TabsTrigger value="income" className="gap-2">
                <ArrowDownCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Receber</span>
              </TabsTrigger>
              <TabsTrigger value="expense" className="gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Pagar</span>
              </TabsTrigger>
              <TabsTrigger value="registers" className="gap-2">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Caixas</span>
              </TabsTrigger>
              <TabsTrigger value="transfers" className="gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                <span className="hidden sm:inline">Transferências</span>
              </TabsTrigger>
              <TabsTrigger value="receivables" className="gap-2">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Recebíveis</span>
              </TabsTrigger>
              <TabsTrigger value="reconciliation" className="gap-2">
                <FileCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Conciliação</span>
              </TabsTrigger>
              <TabsTrigger value="recurring" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Recorrências</span>
              </TabsTrigger>
              <TabsTrigger value="commissions" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Comissões</span>
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Visão Geral */}
          <TabsContent value="overview" className="space-y-6">
            <FinancialMetrics clinicId={currentClinic.id} />
            <FinancialCharts clinicId={currentClinic.id} />
            <TransactionTable clinicId={currentClinic.id} />
          </TabsContent>

          {/* Fluxo de Caixa */}
          <TabsContent value="cashflow">
            <CashFlowPanel clinicId={currentClinic.id} />
          </TabsContent>

          {/* Receitas (Receber) */}
          <TabsContent value="income" className="space-y-6">
            <TransactionTable clinicId={currentClinic.id} filterType="income" />
          </TabsContent>

          {/* Despesas (Pagar) */}
          <TabsContent value="expense" className="space-y-6">
            <TransactionTable clinicId={currentClinic.id} filterType="expense" />
          </TabsContent>

          {/* Caixas */}
          <TabsContent value="registers">
            <CashRegistersPanel clinicId={currentClinic.id} />
          </TabsContent>

          {/* Transferências */}
          <TabsContent value="transfers">
            <TransfersPanel clinicId={currentClinic.id} />
          </TabsContent>

          {/* Controle de Recebíveis */}
          <TabsContent value="receivables">
            <ReceivablesPanel clinicId={currentClinic.id} />
          </TabsContent>

          {/* Conciliação Bancária */}
          <TabsContent value="reconciliation">
            <ReconciliationPanel clinicId={currentClinic.id} />
          </TabsContent>

          {/* Recorrências */}
          <TabsContent value="recurring">
            <RecurringPanel clinicId={currentClinic.id} />
          </TabsContent>

          {/* Comissões */}
          <TabsContent value="commissions">
            <CommissionsPanel clinicId={currentClinic.id} />
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
