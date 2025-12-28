import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Send, Zap, Shield, BarChart } from "lucide-react";
import CampaignsPanel from "@/components/marketing/CampaignsPanel";
import SegmentsPanel from "@/components/marketing/SegmentsPanel";
import AutomationsPanel from "@/components/marketing/AutomationsPanel";

function MarketingContent() {
  const { currentClinic } = useAuth();

  if (!currentClinic) return null;

  return (
    <RoleGuard permission="view_marketing">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing e CRM</h1>
          <p className="text-muted-foreground">
            Gerencie segmentos, campanhas e automações de marketing
          </p>
        </div>

        <Tabs defaultValue="segments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="segments" className="gap-2">
              <Users className="h-4 w-4" />
              Segmentos
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Send className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2">
              <Zap className="h-4 w-4" />
              Automações
            </TabsTrigger>
            <TabsTrigger value="consents" className="gap-2">
              <Shield className="h-4 w-4" />
              Consentimentos
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart className="h-4 w-4" />
              Análises
            </TabsTrigger>
          </TabsList>

          <TabsContent value="segments">
            <SegmentsPanel />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignsPanel />
          </TabsContent>

          <TabsContent value="automations">
            <AutomationsPanel />
          </TabsContent>

          <TabsContent value="consents">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Consentimentos</CardTitle>
                <CardDescription>
                  Controle os opt-ins e opt-outs conforme a LGPD
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Gerencie o consentimento de comunicação dos pacientes</p>
                  <p className="text-sm mt-2">Funcionalidade em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Análises de Marketing</CardTitle>
                <CardDescription>
                  Acompanhe o desempenho das suas campanhas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Métricas e relatórios disponíveis em breve</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}

export default function MarketingPage() {
  return <MarketingContent />;
}
