import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { FeatureGate } from "@/components/features/FeatureGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Send, AlertTriangle, History, Settings } from "lucide-react";

function TissContent() {
  const { currentClinic } = useAuth();

  if (!currentClinic) return null;

  return (
    <RoleGuard permission="view_financials">
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
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guides">
            <Card>
              <CardHeader>
                <CardTitle>Guias TISS</CardTitle>
                <CardDescription>
                  Crie e gerencie guias SP/SADT, Consultas e Internações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Tipos de guias suportados:</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• SP/SADT - Serviço Profissional / Serviço Auxiliar de Diagnóstico e Terapia</li>
                    <li>• Consulta</li>
                    <li>• Internação</li>
                    <li>• Honorários</li>
                  </ul>
                  <p className="mt-4 text-sm">Funcionalidade em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle>Lotes de Envio</CardTitle>
                <CardDescription>
                  Gerencie envios de lotes XML para operadoras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Controle de envios por operadora</p>
                  <p className="text-sm mt-2">Funcionalidade em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gloss">
            <Card>
              <CardHeader>
                <CardTitle>Controle de Glosas</CardTitle>
                <CardDescription>
                  Acompanhe e conteste glosas recebidas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Gerencie glosas com motivos padronizados ANS</p>
                  <p className="text-sm mt-2">Funcionalidade em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Guias</CardTitle>
                <CardDescription>
                  Visualize o histórico completo de alterações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Rastreabilidade completa de todas as guias</p>
                  <p className="text-sm mt-2">Funcionalidade em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configurações TISS</CardTitle>
                <CardDescription>
                  Configure dados do prestador e operadoras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Configure:</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Código do prestador ANS</li>
                    <li>• Versão do padrão TISS</li>
                    <li>• Operadoras cadastradas</li>
                  </ul>
                  <p className="mt-4 text-sm">Funcionalidade em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
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
