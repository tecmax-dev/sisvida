import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { FinancialMetrics } from "@/components/financials/FinancialMetrics";
import { FinancialCharts } from "@/components/financials/FinancialCharts";
import { TransactionTable } from "@/components/financials/TransactionTable";
import { TransactionDialog } from "@/components/financials/TransactionDialog";
import { CategoryDialog } from "@/components/financials/CategoryDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Settings2 } from "lucide-react";

export default function FinancialsPage() {
  const { currentClinic } = useAuth();
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"income" | "expense">("income");

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

        <FinancialMetrics clinicId={currentClinic.id} />

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="income">Receitas</TabsTrigger>
            <TabsTrigger value="expense">Despesas</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <FinancialCharts clinicId={currentClinic.id} />
            <TransactionTable clinicId={currentClinic.id} />
          </TabsContent>

          <TabsContent value="income" className="space-y-6">
            <TransactionTable clinicId={currentClinic.id} filterType="income" />
          </TabsContent>

          <TabsContent value="expense" className="space-y-6">
            <TransactionTable clinicId={currentClinic.id} filterType="expense" />
          </TabsContent>
        </Tabs>

        <TransactionDialog
          open={transactionDialogOpen}
          onOpenChange={setTransactionDialogOpen}
          clinicId={currentClinic.id}
          defaultType={selectedType}
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
