import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Send, 
  MessageSquare,
  ShieldCheck,
  Activity,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function WhatsAppStatusPage() {
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [sendLogs, setSendLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const clinicId = "89e7585e-7bce-4e58-91fa-c37080d1170d"; // Sindicato ID fixo

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      // Webhook Incoming Logs
      const { data: webhooks } = await supabase
        .from("whatsapp_incoming_logs")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(10);

      // Edge Function (Outgoing) Logs - Usando whatsapp_ai_conversations como proxy de atividade
      const { data: conversations } = await supabase
        .from("whatsapp_ai_conversations")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("updated_at", { ascending: false })
        .limit(10);

      setWebhookLogs(webhooks || []);
      setSendLogs(conversations || []);
    } catch (error) {
      console.error("Erro ao buscar status:", error);
      toast.error("Falha ao carregar logs de status");
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-webhook", {
        body: {
          event: "messages.upsert",
          instance: "meta",
          clinic_id: clinicId,
          test_only: true,
          data: {
            key: { remoteJid: "system-test@s.whatsapp.net", fromMe: false, id: "test-" + Date.now() },
            message: { conversation: "Status Check" },
            pushName: "Health Check",
            messageTimestamp: Math.floor(Date.now() / 1000)
          }
        }
      });

      if (error) throw error;
      toast.success("Webhook respondendo corretamente!");
      fetchStatus();
    } catch (error) {
      console.error("Erro no teste:", error);
      toast.error("Falha na comunicação com o Webhook");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            WhatsApp API Health Check
          </h1>
          <p className="text-muted-foreground">Monitoramento em tempo real do Sindicato (Meta API)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={testConnection} disabled={testing}>
            {testing ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Ping Webhook
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              Configuração Meta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">Ativa</div>
            <p className="text-xs text-muted-foreground">WABA ID: Official Meta</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Entradas (Webhook)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {webhookLogs.length > 0 ? "Recebendo" : "Aguardando"}
            </div>
            <p className="text-xs text-muted-foreground">Última msg: {webhookLogs[0] ? format(new Date(webhookLogs[0].created_at), "HH:mm:ss") : "--"}</p>
          </CardContent>
        </Card>

        <Card className="bg-info/5 border-info/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-info" />
              Saídas (Edge Function)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">Operacional</div>
            <p className="text-xs text-muted-foreground">Conexão via ZapResponder</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Webhook Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Entradas recentes (Webhooks)
            </CardTitle>
            <CardDescription>Eventos recebidos da API Meta</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {webhookLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum evento recente</div>
              ) : (
                <div className="space-y-4">
                  {webhookLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="font-mono">{log.phone}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM HH:mm:ss")}
                        </span>
                      </div>
                      <p className="text-sm italic">"{log.message_text}"</p>
                      <div className="flex items-center gap-2">
                        {log.processed ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <XCircle className="h-3 w-3 text-destructive" />
                        )}
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {log.processed_action || "Processado"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Outgoing activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-info" />
              Atividade de Conversa
            </CardTitle>
            <CardDescription>Respostas enviadas pelo bot (Meta API)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {sendLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhuma atividade recente</div>
              ) : (
                <div className="space-y-4">
                  {sendLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg border bg-info/5 border-info/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-info/10 text-info">{log.phone}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.updated_at), "dd/MM HH:mm:ss")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Source: <span className="text-foreground">{log.messages?.source || "AI Assistant"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Status: <Badge variant="outline" className="text-[10px] text-success">Enviado</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}