import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Cake, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Settings,
  Phone,
  Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<BirthdayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ClinicBirthdaySettings>({
    birthday_enabled: false,
    birthday_message: '',
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) { // 55 + DDD + 9 digits
      return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 5)} ${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

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
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Configurar
              </Button>
            </DialogTrigger>
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
      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length > 0 ? (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  log.success ? 'bg-success/15' : 'bg-destructive/15'
                }`}>
                  {log.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{log.patient_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{formatPhone(log.patient_phone)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={log.success ? "default" : "destructive"} className="text-xs">
                    {log.success ? 'Enviado' : 'Falhou'}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(log.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Cake className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem de aniversário enviada ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure o envio automático para começar
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}