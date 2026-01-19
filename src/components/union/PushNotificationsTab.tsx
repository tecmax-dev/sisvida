import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Smartphone,
  Users,
  Clock,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PushNotificationHistory {
  id: string;
  title: string;
  body: string;
  target_type: string;
  total_sent: number;
  total_success: number;
  total_failed: number;
  sent_at: string;
}

interface TokenStats {
  total: number;
  ios: number;
  android: number;
  web: number;
}

export function PushNotificationsTab() {
  const { currentClinic, userRoles, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [addingTestToken, setAddingTestToken] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  // Get the clinic ID to use - prioritize currentClinic, then first available from roles
  const effectiveClinicId = currentClinic?.id || selectedClinicId || userRoles[0]?.clinic?.id || null;

  // For super admins without a clinic, fetch one
  useEffect(() => {
    const fetchClinicForSuperAdmin = async () => {
      if (isSuperAdmin && !currentClinic?.id && !selectedClinicId && userRoles.length === 0) {
        const { data: clinics } = await supabase
          .from("clinics")
          .select("id")
          .limit(1);
        
        if (clinics?.[0]?.id) {
          setSelectedClinicId(clinics[0].id);
          console.log("Super admin: Using clinic", clinics[0].id);
        }
      }
    };
    fetchClinicForSuperAdmin();
  }, [isSuperAdmin, currentClinic?.id, selectedClinicId, userRoles.length]);

  // Add test token for development
  const handleAddTestToken = async () => {
    console.log("handleAddTestToken called, effectiveClinicId:", effectiveClinicId);
    
    if (!effectiveClinicId) {
      toast({
        title: "Erro",
        description: "Clínica não identificada. Selecione uma clínica primeiro.",
        variant: "destructive",
      });
      return;
    }
    
    setAddingTestToken(true);
    try {
      // Get a random patient from the clinic
      console.log("Fetching patients for clinic:", effectiveClinicId);
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", effectiveClinicId)
        .limit(1);

      console.log("Patients result:", patients, "Error:", patientsError);

      if (patientsError) {
        throw new Error(`Erro ao buscar pacientes: ${patientsError.message}`);
      }

      const patientId = patients?.[0]?.id;
      if (!patientId) {
        toast({
          title: "Erro",
          description: "Nenhum paciente/sócio encontrado para vincular o token de teste. Cadastre um sócio primeiro.",
          variant: "destructive",
        });
        setAddingTestToken(false);
        return;
      }

      // Generate a fake FCM token for testing
      const testToken = `test_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log("Inserting test token for patient:", patientId);
      
      const { error } = await supabase
        .from("push_notification_tokens")
        .insert({
          patient_id: patientId,
          clinic_id: effectiveClinicId,
          token: testToken,
          platform: "android",
          is_active: true,
          device_info: { test: true, created_at: new Date().toISOString() },
        });

      if (error) {
        console.error("Insert error:", error);
        throw error;
      }

      console.log("Token inserted successfully");
      toast({
        title: "Token de teste adicionado!",
        description: "Agora você pode testar o envio de notificações (o envio real falhará, mas o fluxo funcionará).",
      });

      queryClient.invalidateQueries({ queryKey: ["push-token-stats"] });
    } catch (err) {
      console.error("Error adding test token:", err);
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao adicionar token",
        variant: "destructive",
      });
    } finally {
      setAddingTestToken(false);
    }
  };

  // Fetch token statistics
  const { data: tokenStats, isLoading: loadingStats } = useQuery({
    queryKey: ["push-token-stats", effectiveClinicId],
    queryFn: async (): Promise<TokenStats> => {
      if (!effectiveClinicId) return { total: 0, ios: 0, android: 0, web: 0 };

      const { data, error } = await supabase
        .from("push_notification_tokens")
        .select("platform")
        .eq("clinic_id", effectiveClinicId)
        .eq("is_active", true);

      if (error) throw error;

      const stats = { total: 0, ios: 0, android: 0, web: 0 };
      data?.forEach((token) => {
        stats.total++;
        if (token.platform === "ios") stats.ios++;
        else if (token.platform === "android") stats.android++;
        else if (token.platform === "web") stats.web++;
      });

      return stats;
    },
    enabled: !!effectiveClinicId,
  });

  // Fetch notification history
  const { data: history, isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["push-notification-history", effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];

      const { data, error } = await supabase
        .from("push_notification_history")
        .select("*")
        .eq("clinic_id", effectiveClinicId)
        .order("sent_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as PushNotificationHistory[];
    },
    enabled: !!effectiveClinicId,
  });

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e a mensagem da notificação.",
        variant: "destructive",
      });
      return;
    }

    if (!effectiveClinicId) {
      toast({
        title: "Erro",
        description: "Clínica não identificada.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          clinic_id: effectiveClinicId,
          title: title.trim(),
          body: body.trim(),
          target_type: "all",
        },
      });

      if (error) throw error;

      toast({
        title: "Notificação enviada!",
        description: `Enviada para ${data.total_sent} dispositivos. Sucesso: ${data.total_success}, Falhas: ${data.total_failed}`,
      });

      setTitle("");
      setBody("");
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ["push-token-stats"] });
    } catch (err) {
      console.error("Error sending push notification:", err);
      toast({
        title: "Erro ao enviar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispositivos Ativos</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingStats ? "..." : tokenStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Tokens registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Android</CardTitle>
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              {loadingStats ? "..." : tokenStats?.android || 0}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {loadingStats ? "..." : tokenStats?.android || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">iOS</CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {loadingStats ? "..." : tokenStats?.ios || 0}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {loadingStats ? "..." : tokenStats?.ios || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Web</CardTitle>
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              {loadingStats ? "..." : tokenStats?.web || 0}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {loadingStats ? "..." : tokenStats?.web || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Send Notification Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Enviar Notificação
            </CardTitle>
            <CardDescription>
              Envie uma notificação push para todos os dispositivos registrados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notification-title">Título</Label>
              <Input
                id="notification-title"
                placeholder="Ex: Nova atualização disponível!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">{title.length}/50 caracteres</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notification-body">Mensagem</Label>
              <Textarea
                id="notification-body"
                placeholder="Ex: Confira as novidades do seu sindicato..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{body.length}/200 caracteres</p>
            </div>

            <Button
              onClick={handleSendNotification}
              disabled={sending || !title.trim() || !body.trim() || (tokenStats?.total || 0) === 0}
              className="w-full"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para {tokenStats?.total || 0} dispositivos
                </>
              )}
            </Button>

            {(tokenStats?.total || 0) === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-amber-600 text-center">
                  ⚠️ Nenhum dispositivo registrado. Os usuários precisam abrir o app mobile para receber notificações.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddTestToken}
                  disabled={addingTestToken}
                  className="w-full"
                >
                  {addingTestToken ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <Smartphone className="mr-2 h-4 w-4" />
                      Adicionar Token de Teste
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico de Envios
                </CardTitle>
                <CardDescription>Últimas 20 notificações enviadas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchHistory()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history && history.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} className="border dark:border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {item.target_type === "all" ? "Todos" : "Específico"}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {format(new Date(item.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {item.total_success}
                          </span>
                          {item.total_failed > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-3 w-3" />
                              {item.total_failed}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação enviada ainda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
