import { useAuth } from "@/hooks/useAuth";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, CreditCard, FileText, PenTool, Loader2 } from "lucide-react";
import PaymentMethodsTab from "@/components/union/PaymentMethodsTab";
import { PresidentSignatureManager } from "@/components/union/signatures/PresidentSignatureManager";

export default function UnionConfigPage() {
  const { currentClinic } = useAuth();
  const { entity, loading: entityLoading } = useUnionEntity();

  if (entityLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!entity && !currentClinic) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Nenhuma entidade sindical encontrada</p>
      </div>
    );
  }

  const sindicatoId = entity?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configurações do Sindicato
        </h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da entidade sindical
        </p>
      </div>

      <Tabs defaultValue="payment-methods" className="space-y-6">
        <TabsList>
          <TabsTrigger value="payment-methods" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Formas de Pagamento
          </TabsTrigger>
          <TabsTrigger value="signature" className="gap-2">
            <PenTool className="h-4 w-4" />
            Assinatura
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payment-methods">
          {sindicatoId ? (
            <PaymentMethodsTab sindicatoId={sindicatoId} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Configure uma entidade sindical para gerenciar formas de pagamento.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="signature">
          <PresidentSignatureManager />
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>
                Configure os documentos exigidos no formulário de filiação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">
                Funcionalidade em desenvolvimento
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
