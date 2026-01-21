import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Cake, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Settings,
  Phone,
  Send,
  Loader2,
  TestTube2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

interface BirthdayLog {
  id: string;
  patient_name: string;
  patient_phone: string;
  sent_at: string;
  success: boolean;
  error_message: string | null;
}

interface ClinicBirthdaySettings {
  birthday_enabled: boolean;
  birthday_message: string;
}

export default function BirthdayMessagesHistory() {
  const { currentClinic, session } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<BirthdayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ClinicBirthdaySettings>({
    birthday_enabled: false,
    birthday_message: '',
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingManual, setSendingManual] = useState(false);
  
  // Test mode state
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);


  useRealtimeSubscription({
    table: 'birthday_message_logs',
    filter: currentClinic ? { column: 'clinic_id', value: currentClinic.id } : undefined,
    onInsert: () => fetchLogs(),
    showToast: false,
    enabled: !!currentClinic,
  });

  useEffect(() => {
    if (currentClinic) {
      fetchLogs();
      fetchSettings();
    }
  }, [currentClinic]);

  const fetchLogs = async () => {
    if (!currentClinic) return;
    
    try {
      const { data, error } = await supabase
        .from('birthday_message_logs')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching birthday logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!currentClinic) return;

    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('birthday_enabled, birthday_message')
        .eq('id', currentClinic.id)
        .single();

      if (error) throw error;
      
      setSettings({
        birthday_enabled: data?.birthday_enabled || false,
        birthday_message: data?.birthday_message || getDefaultMessage(),
      });
    } catch (error) {
      console.error('Error fetching birthday settings:', error);
    }
  };

  const getDefaultMessage = () => {
    return `Olá {nome}! 🎂🎉

A equipe da {clinica} deseja a você um feliz aniversário!

Que este dia seja repleto de alegrias e realizações.

Com carinho,
Equipe {clinica}`;
  };

  const saveSettings = async () => {
    if (!currentClinic) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          birthday_enabled: settings.birthday_enabled,
          birthday_message: settings.birthday_message,
        })
        .eq('id', currentClinic.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações de aniversário foram atualizadas.",
      });
      setSettingsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManualSend = async () => {
    if (!currentClinic) return;
    
    setSendingManual(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-birthday-messages');
      
      if (error) throw error;
      
      const result = data as { sent?: number; errors?: number; skipped?: number };
      
      toast({
        title: "Envio concluído",
        description: `${result.sent || 0} mensagem(s) enviada(s), ${result.errors || 0} erro(s), ${result.skipped || 0} ignorado(s).`,
      });
      
      fetchLogs();
    } catch (error: any) {
      console.error('Error sending birthday messages:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar as mensagens de aniversário.",
        variant: "destructive",
      });
    } finally {
      setSendingManual(false);
    }
  };

  const handleTestSend = async () => {
    if (!currentClinic || !testPhone.trim()) {
      toast({
        title: "Telefone obrigatório",
        description: "Informe um número de telefone para teste.",
        variant: "destructive",
      });
      return;
    }
    
    // Clean phone number - only digits
    const cleanPhone = testPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      toast({
        title: "Telefone inválido",
        description: "O número deve ter entre 10 e 13 dígitos (DDD + número).",
        variant: "destructive",
      });
      return;
    }
    
    setSendingTest(true);
    try {
      // Prefer the in-memory session from AuthProvider (more reliable than getSession here)
      let accessToken = session?.access_token;

      if (!accessToken) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        accessToken = refreshed.session?.access_token;
      }

      if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      console.log('[BirthdayTest] Sending test to:', cleanPhone, 'clinic:', currentClinic.id);

      const { data, error } = await supabase.functions.invoke('send-birthday-test', {
        body: {
          clinicId: currentClinic.id,
          testPhone: cleanPhone,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log('[BirthdayTest] Response:', { data, error });

      if (error) {
        console.error('[BirthdayTest] Error object:', JSON.stringify(error, null, 2));

        // Try to extract the real error message from different possible locations
        let serverMessage = '';

        // Check if error has context with response body
        if ((error as any).context) {
          const ctx = (error as any).context;
          if (typeof ctx === 'string') {
            try {
              const parsed = JSON.parse(ctx);
              serverMessage = parsed.error || parsed.message || '';
            } catch {
              serverMessage = ctx;
            }
          } else if (ctx.body) {
            if (typeof ctx.body === 'string') {
              try {
                const parsed = JSON.parse(ctx.body);
                serverMessage = parsed.error || parsed.message || '';
              } catch {
                serverMessage = ctx.body;
              }
            } else {
              serverMessage = ctx.body.error || ctx.body.message || '';
            }
          }
        }

        throw new Error(serverMessage || error.message || 'Falha ao enviar');
      }

      if (data?.success) {
        toast({
          title: "Teste enviado!",
          description: data.message || "Mensagem de teste enviada com sucesso. Verifique o WhatsApp.",
        });
        setTestPhone("");
      } else {
        throw new Error(data?.error || 'Falha ao enviar');
      }
    } catch (error: any) {
      console.error('[BirthdayTest] Catch error:', error);
      toast({
        title: "Erro no envio de teste",
        description: error.message || "Não foi possível enviar a mensagem de teste.",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) { // 55 + DDD + 9 digits
      return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 5)} ${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: { label: string; logs: BirthdayLog[] } } = {};
    
    logs.forEach((log) => {
      const date = parseISO(log.sent_at);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      let label: string;
      if (isToday(date)) {
        label = 'Hoje';
      } else if (isYesterday(date)) {
        label = 'Ontem';
      } else {
        label = format(date, "dd 'de' MMMM", { locale: ptBR });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = { label, logs: [] };
      }
      groups[dateKey].logs.push(log);
    });
    
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [logs]);

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-warning/15 flex items-center justify-center">
            <Cake className="h-4 w-4 text-warning" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Mensagens de Aniversário</CardTitle>
            <p className="text-sm text-muted-foreground">
              {settings.birthday_enabled ? 'Envio automático ativo' : 'Envio automático desativado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchLogs}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSend}
            disabled={sendingManual || !settings.birthday_enabled}
            className="gap-2"
          >
            {sendingManual ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar Agora
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            Configurar
          </Button>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Configurações de Aniversário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Envio automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar mensagem de aniversário automaticamente
                    </p>
                  </div>
                  <Switch
                    checked={settings.birthday_enabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({ ...prev, birthday_enabled: checked }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem de aniversário</Label>
                  <p className="text-xs text-muted-foreground">
                    Use {'{nome}'} para o nome do paciente e {'{clinica}'} para o nome da clínica
                  </p>
                  <Textarea
                    value={settings.birthday_message}
                    onChange={(e) => 
                      setSettings(prev => ({ ...prev, birthday_message: e.target.value }))
                    }
                    rows={8}
                    placeholder="Digite a mensagem de aniversário..."
                  />
                </div>
                <Button 
                  onClick={saveSettings} 
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? 'Salvando...' : 'Salvar configurações'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Test Section */}
        <div className="p-3 rounded-lg border border-dashed border-border/60 bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <TestTube2 className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Testar Envio</Label>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Envie uma mensagem de teste para validar a configuração. Apenas números (DDD + número). Ex: 11999999999
          </p>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="Ex: 11999999999"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 13))}
              className="flex-1"
              maxLength={13}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestSend}
              disabled={sendingTest || !testPhone.trim()}
              className="gap-2 shrink-0"
            >
              {sendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar Teste
            </Button>
          </div>
           <p className="text-xs text-muted-foreground mt-2 italic">
             O envio de teste não consome créditos do sistema.
           </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length > 0 ? (
          <Accordion type="single" collapsible className="w-full" defaultValue={groupedLogs[0]?.key}>
            {groupedLogs.map((group) => {
              const successCount = group.logs.filter(l => l.success).length;
              const failCount = group.logs.length - successCount;
              
              return (
                <AccordionItem key={group.key} value={group.key} className="border-border/50">
                  <AccordionTrigger className="py-2 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <span className="text-sm font-medium">{group.label}</span>
                      <div className="flex items-center gap-2">
                        {successCount > 0 && (
                          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {successCount}
                          </Badge>
                        )}
                        {failCount > 0 && (
                          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                            <XCircle className="h-3 w-3 mr-1" />
                            {failCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1 pt-1">
                      {group.logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30 transition-colors"
                        >
                          {log.success ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                          <span className="text-sm truncate flex-1">{log.patient_name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(log.sent_at), "HH:mm")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
              <Cake className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem enviada ainda
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}