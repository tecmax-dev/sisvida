import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, MessageSquare } from "lucide-react";

interface SmsTemplate {
  id: string;
  name: string;
  meta_template_name: string | null;
  body: string;
  variables: any;
  status: string;
  updated_at: string;
}

interface SmsLog {
  id: string;
  recipient: string;
  rendered_body: string;
  status: string;
  error: string | null;
  created_at: string;
}

export default function UnionSmsPage() {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customBody, setCustomBody] = useState("");
  const [recipients, setRecipients] = useState("");

  const loadAll = async () => {
    setLoading(true);
    const [{ data: tpls }, { data: lg }] = await Promise.all([
      supabase.from("sms_templates").select("*").order("name"),
      supabase.from("sms_send_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setTemplates((tpls as SmsTemplate[]) ?? []);
    setLogs((lg as SmsLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sindicato-sms-templates-sync");
      if (error) throw error;
      toast.success(`Sincronização concluída: ${data?.synced ?? 0} modelos`);
      await loadAll();
    } catch (err: any) {
      toast.error(`Erro ao sincronizar: ${err.message ?? err}`);
    } finally {
      setSyncing(false);
    }
  };

  const parseRecipients = (text: string) => {
    return text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8)
      .map((phone) => ({ phone }));
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const previewBody = selectedTemplate?.body ?? customBody;

  const handleSend = async () => {
    const list = parseRecipients(recipients);
    if (list.length === 0) {
      toast.error("Informe ao menos um número de telefone");
      return;
    }
    if (!selectedTemplateId && !customBody.trim()) {
      toast.error("Selecione um modelo ou digite o texto do SMS");
      return;
    }
    if (!confirm(`Enviar SMS para ${list.length} destinatário(s)?`)) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("sindicato-send-sms", {
        body: {
          template_id: selectedTemplateId || undefined,
          body: selectedTemplateId ? undefined : customBody,
          recipients: list,
        },
      });
      if (error) throw error;
      toast.success(`${data?.sent ?? 0}/${data?.total ?? 0} SMS enviados`);
      setRecipients("");
      await loadAll();
    } catch (err: any) {
      toast.error(`Erro: ${err.message ?? err}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">SMS (Comtele)</h1>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sincronizar do WhatsApp
        </Button>
      </div>

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Envio</TabsTrigger>
          <TabsTrigger value="templates">Modelos ({templates.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Enviar SMS</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Modelo (opcional)</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">— Texto livre —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {!selectedTemplateId && (
                <div className="space-y-2">
                  <Label>Texto do SMS</Label>
                  <Textarea
                    rows={4}
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder="Digite a mensagem (máx 160 caracteres recomendado)"
                  />
                  <p className="text-xs text-muted-foreground">{customBody.length} caracteres</p>
                </div>
              )}

              {selectedTemplate && (
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {previewBody}
                </div>
              )}

              <div className="space-y-2">
                <Label>Destinatários (um por linha, ou separados por vírgula)</Label>
                <Textarea
                  rows={5}
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="73999990000&#10;11988887777"
                />
                <p className="text-xs text-muted-foreground">
                  {parseRecipients(recipients).length} número(s) detectado(s)
                </p>
              </div>

              <Button onClick={handleSend} disabled={sending} className="w-full">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar SMS
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-2">
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : templates.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum modelo cadastrado. Clique em "Sincronizar do WhatsApp" para importar modelos aprovados.</p>
          ) : templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium">{t.name}</p>
                  <Badge variant="outline">{t.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum envio registrado ainda.</p>
          ) : logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm">{log.recipient}</p>
                  <Badge variant={log.status === "sent" ? "default" : "destructive"}>{log.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{log.rendered_body}</p>
                {log.error && <p className="text-xs text-destructive mt-1">{log.error}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}