import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { FeatureGate } from "@/components/features/FeatureGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Send, AlertTriangle, Settings, Loader2 } from "lucide-react";
import { TissGuidesPanel } from "@/components/tiss/TissGuidesPanel";
import { TissSubmissionsPanel } from "@/components/tiss/TissSubmissionsPanel";
import { TissGlossesPanel } from "@/components/tiss/TissGlossesPanel";
import { TissSettingsPanel } from "@/components/tiss/TissSettingsPanel";

function TissContent() {
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
    <RoleGuard permission="view_tiss">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">TISS - Faturamento ANS</h1>
          <p className="text-muted-foreground">
            Gerencie guias TISS, envios e glosas de convênios
          </p>
        </div>

        <Tabs defaultValue="guides" className="space-y-4">
          <TabsList>
            <TabsTrigger value="guides" className="gap-2">
              <FileText className="h-4 w-4" />
              Guias
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-2">
              <Send className="h-4 w-4" />
              Envios
            </TabsTrigger>
            <TabsTrigger value="gloss" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Glosas
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guides">
            <TissGuidesPanel clinicId={currentClinic.id} />
          </TabsContent>

          <TabsContent value="submissions">
            <TissSubmissionsPanel clinicId={currentClinic.id} />
          </TabsContent>

          <TabsContent value="gloss">
            <TissGlossesPanel clinicId={currentClinic.id} />
          </TabsContent>

          <TabsContent value="settings">
            <TissSettingsPanel clinicId={currentClinic.id} />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}

export default function TissPage() {
  return (
    <FeatureGate feature="financial_management" showUpgradePrompt>
      <TissContent />
    </FeatureGate>
  );
}
