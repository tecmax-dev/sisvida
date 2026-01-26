import { useAuth } from "@/hooks/useAuth";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, CreditCard, FileText, Image, Loader2, Calendar } from "lucide-react";
import PaymentMethodsTab from "@/components/union/PaymentMethodsTab";
import { UnionBrandingSettings } from "@/components/union/settings/UnionBrandingSettings";
import { BookingMonthsSettings } from "@/components/union/settings/BookingMonthsSettings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function UnionConfigPage() {
  const { currentClinic } = useAuth();
  const { entity, loading: entityLoading } = useUnionEntity();

  // Fetch clinic booking settings
  const { data: clinicSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["clinic-booking-settings", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data, error } = await supabase
        .from("clinics")
        .select("booking_months_ahead")
        .eq("id", currentClinic.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic?.id,
  });

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

      <Tabs defaultValue="booking" className="space-y-6">
        <TabsList>
          <TabsTrigger value="booking" className="gap-2">
            <Calendar className="h-4 w-4" />
            Agendamento
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Image className="h-4 w-4" />
            Identidade Visual
          </TabsTrigger>
          <TabsTrigger value="payment-methods" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Formas de Pagamento
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="booking">
          {currentClinic?.id ? (
            <BookingMonthsSettings
              clinicId={currentClinic.id}
              currentValue={clinicSettings?.booking_months_ahead ?? 1}
              onUpdate={() => refetchSettings()}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Configure uma entidade sindical para gerenciar agendamentos.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="branding">
          {sindicatoId ? (
            <UnionBrandingSettings
              entityId={sindicatoId}
              logoUrl={(entity as any)?.logo_url}
              presidentName={(entity as any)?.president_name}
              presidentSignatureUrl={(entity as any)?.president_signature_url}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Configure uma entidade sindical para gerenciar identidade visual.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

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
