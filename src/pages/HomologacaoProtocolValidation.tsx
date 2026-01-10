import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar, 
  User, 
  Building2, 
  MapPin,
  AlertTriangle,
  FileCheck
} from "lucide-react";

export default function HomologacaoProtocolValidation() {
  const { token } = useParams<{ token: string }>();

  const { data: appointment, isLoading, error } = useQuery({
    queryKey: ["homologacao-protocol-validation", token],
    queryFn: async () => {
      if (!token) throw new Error("Token não fornecido");
      
      // Try to find by confirmation_token first, then fallback to id for backward compatibility
      const { data, error } = await supabase
        .from("homologacao_appointments")
        .select(`
          *,
          professional:homologacao_professionals(name, function, phone, address, city, state_code),
          service_type:homologacao_service_types(name),
          clinic:clinics(name, phone, address, city, state_code)
        `)
        .or(`confirmation_token.eq.${token},id.eq.${token}`)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-16 w-16 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-red-800 mb-2">Protocolo Inválido</h1>
            <p className="text-muted-foreground">
              Não foi possível encontrar o agendamento com este protocolo.
              Verifique se o link está correto ou entre em contato com o atendimento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'scheduled':
        return { 
          icon: Clock, 
          color: 'bg-blue-100 text-blue-600', 
          badge: 'bg-blue-500',
          label: 'Agendado',
          description: 'O agendamento está confirmado e aguardando a data marcada.'
        };
      case 'confirmed':
        return { 
          icon: CheckCircle, 
          color: 'bg-emerald-100 text-emerald-600', 
          badge: 'bg-emerald-500',
          label: 'Confirmado',
          description: 'O agendamento foi confirmado pela empresa.'
        };
      case 'completed':
        return { 
          icon: FileCheck, 
          color: 'bg-green-100 text-green-600', 
          badge: 'bg-green-500',
          label: 'Realizado',
          description: 'O atendimento foi concluído com sucesso.'
        };
      case 'cancelled':
        return { 
          icon: XCircle, 
          color: 'bg-red-100 text-red-600', 
          badge: 'bg-red-500',
          label: 'Cancelado',
          description: 'O agendamento foi cancelado.'
        };
      case 'no_show':
        return { 
          icon: AlertTriangle, 
          color: 'bg-amber-100 text-amber-600', 
          badge: 'bg-amber-500',
          label: 'Não Compareceu',
          description: 'O agendamento não foi realizado por ausência.'
        };
      default:
        return { 
          icon: Clock, 
          color: 'bg-gray-100 text-gray-600', 
          badge: 'bg-gray-500',
          label: status,
          description: ''
        };
    }
  };

  const statusInfo = getStatusInfo(appointment.status);
  const StatusIcon = statusInfo.icon;
  const professional = appointment.professional as any;
  const clinic = appointment.clinic as any;
  const address = professional?.address || clinic?.address;
  const city = professional?.city || clinic?.city;
  const stateCode = professional?.state_code || clinic?.state_code;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${statusInfo.color}`}>
            <StatusIcon className="w-8 h-8" />
          </div>
          <Badge className={`${statusInfo.badge} text-white mb-2`}>
            {statusInfo.label}
          </Badge>
          <CardTitle className="text-lg">Validação de Protocolo</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Protocol number */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Número do Protocolo</p>
            <p className="text-xl font-bold font-mono">
              {appointment.protocol_number || `HOM-${appointment.id.slice(0, 8).toUpperCase()}`}
            </p>
          </div>

          {/* Status description */}
          {statusInfo.description && (
            <p className="text-sm text-center text-muted-foreground">
              {statusInfo.description}
            </p>
          )}

          {/* Appointment details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium">
                  {format(new Date(appointment.appointment_date + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horário</p>
                <p className="font-medium">
                  {appointment.start_time?.slice(0, 5)} - {appointment.end_time?.slice(0, 5)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profissional</p>
                <p className="font-medium">{professional?.name}</p>
                {professional?.function && (
                  <p className="text-sm text-muted-foreground">{professional.function}</p>
                )}
              </div>
            </div>

            {appointment.service_type && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <FileCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serviço</p>
                  <p className="font-medium">{(appointment.service_type as any)?.name}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-medium">{appointment.company_name}</p>
              </div>
            </div>

            {address && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Local</p>
                  <p className="font-medium">{address}</p>
                  {city && <p className="text-sm text-muted-foreground">{city}{stateCode && ` - ${stateCode}`}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Cancellation reason */}
          {appointment.status === 'cancelled' && appointment.cancellation_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">Motivo do cancelamento:</p>
              <p className="text-sm text-red-700">{appointment.cancellation_reason}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>Protocolo validado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}