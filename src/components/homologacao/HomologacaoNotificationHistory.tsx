import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationLog {
  id: string;
  channel: "whatsapp" | "email";
  recipient_phone?: string | null;
  recipient_email?: string | null;
  message?: string | null;
  protocol_sent?: boolean | null;
  status: string;
  error_message?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
}

interface HomologacaoNotificationHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  appointmentInfo?: {
    employee_name: string;
    company_name: string;
    protocol_number?: string | null;
  };
}

export function HomologacaoNotificationHistory({
  open,
  onOpenChange,
  appointmentId,
  appointmentInfo,
}: HomologacaoNotificationHistoryProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["homologacao-notification-logs", appointmentId],
    queryFn: async () => {
      if (!appointmentId) return [];
      const { data, error } = await supabase
        .from("homologacao_notification_logs")
        .select("*")
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as NotificationLog[];
    },
    enabled: open && !!appointmentId,
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "sent":
        return {
          icon: CheckCircle2,
          color: "text-green-600",
          bgColor: "bg-green-100",
          label: "Enviado",
        };
      case "failed":
        return {
          icon: XCircle,
          color: "text-red-600",
          bgColor: "bg-red-100",
          label: "Falhou",
        };
      case "pending":
      default:
        return {
          icon: Clock,
          color: "text-amber-600",
          bgColor: "bg-amber-100",
          label: "Pendente",
        };
    }
  };

  const getChannelConfig = (channel: string) => {
    if (channel === "whatsapp") {
      return {
        icon: MessageCircle,
        color: "text-green-600",
        label: "WhatsApp",
      };
    }
    return {
      icon: Mail,
      color: "text-blue-600",
      label: "E-mail",
    };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Histórico de Notificações
          </SheetTitle>
          {appointmentInfo && (
            <SheetDescription className="space-y-1">
              <div className="font-medium text-foreground">
                {appointmentInfo.employee_name}
              </div>
              <div>{appointmentInfo.company_name}</div>
              {appointmentInfo.protocol_number && (
                <Badge variant="outline" className="mt-1">
                  <FileText className="h-3 w-3 mr-1" />
                  {appointmentInfo.protocol_number}
                </Badge>
              )}
            </SheetDescription>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] mt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3 pr-4">
              {logs.map((log) => {
                const statusConfig = getStatusConfig(log.status);
                const channelConfig = getChannelConfig(log.channel);
                const StatusIcon = statusConfig.icon;
                const ChannelIcon = channelConfig.icon;

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "border rounded-lg p-3 space-y-2",
                      log.status === "failed" && "border-red-200 bg-red-50/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ChannelIcon className={cn("h-4 w-4", channelConfig.color)} />
                        <span className="font-medium text-sm">{channelConfig.label}</span>
                        {log.protocol_sent && (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            Protocolo
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(statusConfig.bgColor, statusConfig.color, "border-0")}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {log.recipient_phone && (
                        <div>Tel: {log.recipient_phone}</div>
                      )}
                      {log.recipient_email && (
                        <div>Email: {log.recipient_email}</div>
                      )}
                    </div>

                    {log.error_message && (
                      <div className="text-xs text-red-600 bg-red-100 rounded p-2">
                        {log.error_message}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {log.sent_at
                        ? format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })
                        : log.created_at
                        ? format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })
                        : "-"}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma notificação enviada</p>
              <p className="text-sm">para este agendamento.</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
