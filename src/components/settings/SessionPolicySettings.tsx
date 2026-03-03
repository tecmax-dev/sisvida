import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Monitor, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActiveSession {
  id: string;
  user_id: string;
  session_token: string;
  device_info: string | null;
  logged_in_at: string;
  last_seen_at: string;
  is_active: boolean;
}

export function SessionPolicySettings() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (!currentClinic?.id) return;
    loadSettings();
    loadActiveSessions();
  }, [currentClinic?.id]);

  const loadSettings = async () => {
    if (!currentClinic?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('clinics')
      .select('allow_multiple_sessions')
      .eq('id', currentClinic.id)
      .single();
    
    if (data) {
      setAllowMultiple(data.allow_multiple_sessions ?? true);
    }
    setLoading(false);
  };

  const loadActiveSessions = async () => {
    if (!currentClinic?.id) return;
    setLoadingSessions(true);
    const { data } = await supabase
      .from('user_active_sessions')
      .select('*')
      .eq('clinic_id', currentClinic.id)
      .eq('is_active', true)
      .order('logged_in_at', { ascending: false })
      .limit(50);
    
    if (data) {
      setSessions(data as ActiveSession[]);
    }
    setLoadingSessions(false);
  };

  const handleToggle = async (value: boolean) => {
    if (!currentClinic?.id) return;
    setSaving(true);
    
    const { error } = await supabase
      .from('clinics')
      .update({ allow_multiple_sessions: value })
      .eq('id', currentClinic.id);
    
    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAllowMultiple(value);
      toast({
        title: "Configuração salva",
        description: value 
          ? "Login múltiplo permitido. Usuários podem ter várias sessões ativas."
          : "Login único ativado. Novo login derrubará a sessão anterior.",
      });
    }
    setSaving(false);
  };

  const handleInvalidateSession = async (sessionId: string) => {
    const { error } = await supabase
      .from('user_active_sessions')
      .update({ 
        is_active: false, 
        invalidated_at: new Date().toISOString(), 
        invalidated_reason: 'admin_revoked' 
      })
      .eq('id', sessionId);
    
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast({ title: "Sessão encerrada" });
    }
  };

  const handleInvalidateAll = async () => {
    if (!currentClinic?.id) return;
    
    const { error } = await supabase
      .from('user_active_sessions')
      .update({ 
        is_active: false, 
        invalidated_at: new Date().toISOString(), 
        invalidated_reason: 'admin_revoked_all' 
      })
      .eq('clinic_id', currentClinic.id)
      .eq('is_active', true);
    
    if (!error) {
      setSessions([]);
      toast({ title: "Todas as sessões foram encerradas" });
    }
  };

  const parseDeviceInfo = (ua: string | null): string => {
    if (!ua) return "Dispositivo desconhecido";
    if (ua.includes("Mobile")) return "📱 Mobile";
    if (ua.includes("Windows")) return "🖥️ Windows";
    if (ua.includes("Mac")) return "🖥️ Mac";
    if (ua.includes("Linux")) return "🖥️ Linux";
    return "🖥️ Desktop";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Permitir login múltiplo</p>
          <p className="text-sm text-muted-foreground">
            Quando desativado, um novo login derrubará automaticamente a sessão anterior do mesmo usuário
          </p>
        </div>
        <Switch
          checked={allowMultiple}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>

      {!allowMultiple && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            ⚠️ <strong>Login único ativo:</strong> Quando um usuário fizer login em outro dispositivo, 
            a sessão anterior será encerrada automaticamente e o usuário será deslogado.
          </p>
        </div>
      )}

      {/* Active Sessions */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-medium text-foreground text-sm">Sessões Ativas</p>
            <p className="text-xs text-muted-foreground">
              {sessions.length} sessão(ões) ativa(s)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadActiveSessions} disabled={loadingSessions}>
              {loadingSessions ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atualizar"}
            </Button>
            {sessions.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleInvalidateAll}>
                Encerrar Todas
              </Button>
            )}
          </div>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma sessão ativa encontrada
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{parseDeviceInfo(session.device_info)}</p>
                    <p className="text-xs text-muted-foreground">
                      Login: {format(new Date(session.logged_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    Ativa
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInvalidateSession(session.id)}
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
