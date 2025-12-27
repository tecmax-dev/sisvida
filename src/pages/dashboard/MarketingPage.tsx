import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Send, Zap, Shield, BarChart } from "lucide-react";

function MarketingContent() {
  const { currentClinic } = useAuth();

  if (!currentClinic) return null;

  return (
    <RoleGuard permission="view_dashboard">
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
            <Card>
              <CardHeader>
                <CardTitle>Segmentos de Pacientes</CardTitle>
                <CardDescription>
                  Crie segmentos dinâmicos baseados em critérios específicos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Em breve você poderá criar segmentos como:</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Pacientes que não retornam há mais de 6 meses</li>
                    <li>• Aniversariantes do mês</li>
                    <li>• Pacientes de um procedimento específico</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Campanhas de Marketing</CardTitle>
                <CardDescription>
                  Envie mensagens personalizadas para seus pacientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Crie campanhas via WhatsApp, SMS ou Email</p>
                  <p className="text-sm mt-2">Funcionalidade em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automations">
            <Card>
              <CardHeader>
                <CardTitle>Fluxos de Automação</CardTitle>
                <CardDescription>
                  Configure mensagens automáticas baseadas em eventos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Automações disponíveis em breve:</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Pós-atendimento (agradecimento)</li>
                    <li>• Lembrete de retorno</li>
                    <li>• Reativação de pacientes inativos</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
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
