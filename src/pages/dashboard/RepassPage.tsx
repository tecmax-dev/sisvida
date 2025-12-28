import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { FeatureGate } from "@/components/features/FeatureGate";
import { RepassRulesPanel } from "@/components/repass/RepassRulesPanel";
import { RepassPeriodsPanel } from "@/components/repass/RepassPeriodsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Calendar, FileText, DollarSign, Loader2 } from "lucide-react";

function RepassContent() {
  const { currentClinic, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentClinic) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma clínica selecionada
      </div>
    );
  }

  return (
    <RoleGuard permission="view_repass">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Repasse Médico</h1>
          <p className="text-muted-foreground">
            Configure regras de repasse e gerencie os pagamentos aos profissionais
          </p>
        </div>

        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rules" className="gap-2">
              <Settings className="h-4 w-4" />
              Regras
            </TabsTrigger>
            <TabsTrigger value="periods" className="gap-2">
              <Calendar className="h-4 w-4" />
              Períodos
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2">
              <FileText className="h-4 w-4" />
              Itens
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Pagamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            <RepassRulesPanel clinicId={currentClinic.id} />
          </TabsContent>

          <TabsContent value="periods">
            <RepassPeriodsPanel clinicId={currentClinic.id} />
          </TabsContent>

          <TabsContent value="items">
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              Os itens de repasse são gerados automaticamente quando um período é calculado.
              Selecione um período na aba "Períodos" para ver os detalhes.
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              Os pagamentos são gerados quando um período é aprovado e pago.
              Selecione um período na aba "Períodos" para gerenciar pagamentos.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}

export default function RepassPage() {
  return (
    <FeatureGate feature="financial_management" showUpgradePrompt>
      <RepassContent />
    </FeatureGate>
  );
}
