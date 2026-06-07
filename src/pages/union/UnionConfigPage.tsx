import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, CreditCard, FileText, Image, Loader2, Calendar, FileCheck, MessageSquare } from "lucide-react";
import PaymentMethodsTab from "@/components/union/PaymentMethodsTab";
import { UnionBrandingSettings } from "@/components/union/settings/UnionBrandingSettings";
import { BookingMonthsSettings } from "@/components/union/settings/BookingMonthsSettings";
import { AdvanceBookingHoursSettings } from "@/components/union/settings/AdvanceBookingHoursSettings";
import { DependentBookingLimitSettings } from "@/components/union/settings/DependentBookingLimitSettings";
import { TitularBookingLimitSettings } from "@/components/union/settings/TitularBookingLimitSettings";
import { PayslipAcceptanceSettings } from "@/components/union/settings/PayslipAcceptanceSettings";
import { ReminderIntervalSettings } from "@/components/union/settings/ReminderIntervalSettings";
import { AppointmentSmsTemplateSettings } from "@/components/union/settings/AppointmentSmsTemplateSettings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
export default function UnionConfigPage() {
  const { currentClinic, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const { entity, loading: entityLoading } = useUnionEntity();
  const { isAdmin } = usePermissions();

  // Fetch clinic booking settings
  const { data: clinicSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["clinic-booking-settings", resolvedClinic?.id],
    queryFn: async () => {
      if (!resolvedClinic?.id) return null;
      const { data, error } = await supabase
        .from("clinics")
        .select("booking_months_ahead, min_advance_booking_hours, dependent_booking_period, dependent_booking_limit, dependent_booking_limit_enabled, titular_booking_limit_enabled, payslip_acceptance_days, reminder_interval")
        .eq("id", resolvedClinic.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!resolvedClinic?.id,
  });

  if (entityLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!entity && !resolvedClinic) {
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
          <TabsTrigger value="payslip" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Contracheque
          </TabsTrigger>
          <TabsTrigger value="sms-template" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Lembrete
          </TabsTrigger>
        </TabsList>

        <TabsContent value="booking">
          {resolvedClinic?.id ? (
            <div className="space-y-6">
              <BookingMonthsSettings
                clinicId={resolvedClinic.id}
                currentValue={clinicSettings?.booking_months_ahead ?? 1}
                onUpdate={() => refetchSettings()}
                isAdmin={isAdmin}
              />
              <TitularBookingLimitSettings
                clinicId={resolvedClinic.id}
                currentEnabled={(clinicSettings as any)?.titular_booking_limit_enabled ?? true}
                onUpdate={() => refetchSettings()}
                isAdmin={isAdmin}
              />
              <AdvanceBookingHoursSettings
                clinicId={resolvedClinic.id}
                currentValue={(clinicSettings as any)?.min_advance_booking_hours ?? 6}
                onUpdate={() => refetchSettings()}
                isAdmin={isAdmin}
              />
              <ReminderIntervalSettings
                clinicId={resolvedClinic.id}
                currentValue={(clinicSettings as any)?.reminder_interval ?? 60}
                onUpdate={() => refetchSettings()}
                isAdmin={isAdmin}
              />
              <DependentBookingLimitSettings
                clinicId={resolvedClinic.id}
                currentPeriod={(clinicSettings as any)?.dependent_booking_period ?? "monthly"}
                currentLimit={(clinicSettings as any)?.dependent_booking_limit ?? 1}
                currentEnabled={(clinicSettings as any)?.dependent_booking_limit_enabled ?? true}
                onUpdate={() => refetchSettings()}
                isAdmin={isAdmin}
              />
            </div>
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

        <TabsContent value="payslip">
          {resolvedClinic?.id ? (
            <PayslipAcceptanceSettings
              clinicId={resolvedClinic.id}
              currentValue={(clinicSettings as any)?.payslip_acceptance_days ?? 60}
              onUpdate={() => refetchSettings()}
              isAdmin={isAdmin}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Configure uma entidade sindical para gerenciar esta configuração.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sms-template">
          <AppointmentSmsTemplateSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
