import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { MessageSquare, Cake, Bell, CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MessageLog {
  id: string;
  clinic_id: string;
  message_type: string;
  phone: string;
  sent_at: string;
}

interface BirthdayLog {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  sent_at: string;
  success: boolean;
  error_message: string | null;
}

interface MessageHistoryPanelProps {
  clinicId: string;
}

export function MessageHistoryPanel({ clinicId }: MessageHistoryPanelProps) {
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [birthdayLogs, setBirthdayLogs] = useState<BirthdayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Subscribe to realtime updates
  useRealtimeSubscription({ 
    table: 'message_logs', 
    filter: { column: 'clinic_id', value: clinicId },
    showToast: false
  });
  useRealtimeSubscription({ 
    table: 'birthday_message_logs', 
    filter: { column: 'clinic_id', value: clinicId },
    showToast: false
  });

  const fetchLogs = async () => {
    if (!clinicId) return;

    try {
      // Fetch message logs (reminders)
      const { data: messages, error: messagesError } = await supabase
        .from('message_logs')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (messagesError) {
        console.error('Error fetching message logs:', messagesError);
      } else {
        setMessageLogs(messages || []);
      }

      // Fetch birthday logs
      const { data: birthdays, error: birthdaysError } = await supabase
        .from('birthday_message_logs')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (birthdaysError) {
        console.error('Error fetching birthday logs:', birthdaysError);
      } else {
        setBirthdayLogs(birthdays || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [clinicId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const ddd = cleaned.slice(2, 4);
      const part1 = cleaned.slice(4, 9);
      const part2 = cleaned.slice(9);
      return `(${ddd}) ${part1}-${part2}`;
    }
    return phone;
  };

  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case 'reminder':
        return { label: 'Lembrete', icon: Bell, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
      case 'birthday':
        return { label: 'Aniversário', icon: Cake, color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' };
      default:
        return { label: type, icon: MessageSquare, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
    }
  };

  const reminderLogs = messageLogs.filter(log => log.message_type === 'reminder');
  const allBirthdayLogs = [...birthdayLogs, ...messageLogs.filter(log => log.message_type === 'birthday')];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Histórico de Mensagens</CardTitle>
              <CardDescription>
                Acompanhe todos os envios automáticos de WhatsApp
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Todos
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {messageLogs.length + birthdayLogs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="reminders" className="gap-2">
              <Bell className="h-4 w-4" />
              Lembretes
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {reminderLogs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="birthdays" className="gap-2">
              <Cake className="h-4 w-4" />
              Aniversários
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {birthdayLogs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messageLogs.length === 0 && birthdayLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma mensagem enviada ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {[...messageLogs.map(log => ({
                    id: log.id,
                    type: log.message_type,
                    phone: log.phone,
                    sent_at: log.sent_at,
                    success: true,
                    patient_name: null,
                    error_message: null
                  })), ...birthdayLogs.map(log => ({
                    id: log.id,
                    type: 'birthday',
                    phone: log.patient_phone,
                    sent_at: log.sent_at,
                    success: log.success,
                    patient_name: log.patient_name,
                    error_message: log.error_message
                  }))]
                    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
                    .map((log) => {
                      const typeInfo = getMessageTypeLabel(log.type);
                      const TypeIcon = typeInfo.icon;
                      
                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${typeInfo.color}`}>
                              <TypeIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {log.patient_name || formatPhone(log.phone)}
                                </span>
                                {log.success ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                              {log.patient_name && (
                                <p className="text-sm text-muted-foreground">
                                  {formatPhone(log.phone)}
                                </p>
                              )}
                              {log.error_message && (
                                <p className="text-xs text-red-500 mt-1">
                                  {log.error_message}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={typeInfo.color}>
                              {typeInfo.label}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="reminders" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reminderLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum lembrete enviado ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {reminderLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          <Bell className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-medium text-foreground">
                            {formatPhone(log.phone)}
                          </span>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-green-600">Enviado</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="birthdays" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : birthdayLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Cake className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma mensagem de aniversário enviada ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {birthdayLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300">
                          <Cake className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {log.patient_name}
                            </span>
                            {log.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatPhone(log.patient_phone)}
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-red-500 mt-1">
                              {log.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
