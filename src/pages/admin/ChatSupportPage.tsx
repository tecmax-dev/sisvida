import { useState, useEffect } from 'react';
import { MessageCircle, Settings, Users, Clock, Power, Save, Loader2, X, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  status: 'open' | 'closed' | 'pending';
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'support' | 'system';
  sender_id: string;
  sender_name: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ChatSettings {
  id: string;
  is_enabled: boolean;
  auto_offline_message: string;
  timezone: string;
  manual_override: 'online' | 'offline' | null;
}

interface WorkingHour {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const ChatSupportPage = () => {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('open');

  // Fetch all data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch conversations
      const { data: convData, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;
      const typedConversations: Conversation[] = (convData || []).map((c) => ({
        ...c,
        status: c.status as 'open' | 'closed' | 'pending',
      }));
      setConversations(typedConversations);

      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('chat_settings')
        .select('*')
        .limit(1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      if (settingsData) {
        const typedSettings: ChatSettings = {
          ...settingsData,
          manual_override: settingsData.manual_override as 'online' | 'offline' | null,
        };
        setSettings(typedSettings);
      }

      // Fetch working hours
      const { data: hoursData, error: hoursError } = await supabase
        .from('chat_working_hours')
        .select('*')
        .order('day_of_week');

      if (hoursError) throw hoursError;
      setWorkingHours(hoursData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch messages when conversation is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversation) {
        setMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      const typedMessages: Message[] = (data || []).map((m) => ({
        ...m,
        sender_type: m.sender_type as 'user' | 'support' | 'system',
      }));
      setMessages(typedMessages);

      // Mark user messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', selectedConversation.id)
        .eq('sender_type', 'user')
        .eq('is_read', false);
    };

    fetchMessages();
  }, [selectedConversation]);

  // Realtime subscription for conversations
  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`admin-chat-messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id]);

  // Save settings
  const handleSaveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('chat_settings')
        .update({
          is_enabled: settings.is_enabled,
          auto_offline_message: settings.auto_offline_message,
          manual_override: settings.manual_override,
        })
        .eq('id', settings.id);

      if (error) throw error;
      toast.success('Configurações salvas');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  // Save working hours
  const handleSaveHours = async () => {
    setIsSaving(true);
    try {
      for (const hour of workingHours) {
        const { error } = await supabase
          .from('chat_working_hours')
          .update({
            start_time: hour.start_time,
            end_time: hour.end_time,
            is_active: hour.is_active,
          })
          .eq('id', hour.id);

        if (error) throw error;
      }
      toast.success('Horários salvos');
    } catch (error) {
      console.error('Error saving hours:', error);
      toast.error('Erro ao salvar horários');
    } finally {
      setIsSaving(false);
    }
  };

  // Send reply
  const handleSendReply = async () => {
    if (!selectedConversation || !replyText.trim() || !user) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: selectedConversation.id,
        sender_type: 'support',
        sender_id: user.id,
        sender_name: profile?.name || 'Suporte',
        message: replyText.trim(),
      });

      if (error) throw error;

      // Update conversation
      await supabase
        .from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setReplyText('');
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  // Close conversation
  const handleCloseConversation = async () => {
    if (!selectedConversation || !user) return;

    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user.id,
        })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      toast.success('Conversa encerrada');
      setSelectedConversation(null);
      fetchData();
    } catch (error) {
      console.error('Error closing conversation:', error);
      toast.error('Erro ao encerrar conversa');
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6" />
          Chat de Suporte
        </h1>
        <p className="text-muted-foreground">
          Gerencie conversas e configure o atendimento
        </p>
      </div>

      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="hours" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horários
          </TabsTrigger>
        </TabsList>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'open' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('open')}
            >
              Abertas
            </Button>
            <Button
              variant={statusFilter === 'closed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('closed')}
            >
              Encerradas
            </Button>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Todas
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Conversations List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Conversas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {filteredConversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Nenhuma conversa encontrada
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredConversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv)}
                          className={cn(
                            'w-full p-3 text-left hover:bg-muted/50 transition-colors',
                            selectedConversation?.id === conv.id && 'bg-muted'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm truncate">
                              {conv.user_name || 'Usuário'}
                            </span>
                            <Badge
                              variant={conv.status === 'open' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {conv.status === 'open' ? 'Aberta' : 'Encerrada'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.user_email}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(conv.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat View */}
            <Card className="lg:col-span-2">
              {selectedConversation ? (
                <>
                  <CardHeader className="pb-2 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">
                          {selectedConversation.user_name || 'Usuário'}
                        </CardTitle>
                        <CardDescription>
                          {selectedConversation.user_email}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {selectedConversation.status === 'open' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCloseConversation}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Encerrar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex flex-col h-[420px]">
                    <ScrollArea className="flex-1 p-4">
                      <div className="flex flex-col gap-3">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              'flex flex-col max-w-[80%]',
                              msg.sender_type === 'user'
                                ? 'self-start items-start'
                                : 'self-end items-end'
                            )}
                          >
                            <span className="text-xs text-muted-foreground mb-1 px-2">
                              {msg.sender_name} • {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                            <div
                              className={cn(
                                'px-3 py-2 rounded-2xl',
                                msg.sender_type === 'user'
                                  ? 'bg-muted text-foreground rounded-bl-md'
                                  : 'bg-primary text-primary-foreground rounded-br-md'
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {selectedConversation.status === 'open' && (
                      <div className="p-3 border-t">
                        <div className="flex gap-2">
                          <Input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Digite sua resposta..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply();
                              }
                            }}
                          />
                          <Button onClick={handleSendReply} disabled={isSending}>
                            {isSending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-[500px] text-muted-foreground">
                  Selecione uma conversa para visualizar
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Chat</CardTitle>
              <CardDescription>
                Configure o comportamento do chat de suporte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Chat Habilitado</Label>
                      <p className="text-sm text-muted-foreground">
                        Ativar ou desativar o chat globalmente
                      </p>
                    </div>
                    <Switch
                      checked={settings.is_enabled}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, is_enabled: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Override Manual</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Forçar status online/offline ignorando horários
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant={settings.manual_override === 'online' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            manual_override: settings.manual_override === 'online' ? null : 'online',
                          })
                        }
                      >
                        <Power className="h-4 w-4 mr-1" />
                        Forçar Online
                      </Button>
                      <Button
                        variant={settings.manual_override === 'offline' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            manual_override: settings.manual_override === 'offline' ? null : 'offline',
                          })
                        }
                      >
                        <Power className="h-4 w-4 mr-1" />
                        Forçar Offline
                      </Button>
                    </div>
                    {settings.manual_override && (
                      <p className="text-xs text-amber-600">
                        Override ativo: {settings.manual_override}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem de Offline</Label>
                    <Textarea
                      value={settings.auto_offline_message}
                      onChange={(e) =>
                        setSettings({ ...settings, auto_offline_message: e.target.value })
                      }
                      placeholder="Mensagem exibida quando offline..."
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleSaveSettings} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Configurações
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Working Hours Tab */}
        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Horários de Atendimento</CardTitle>
              <CardDescription>
                Configure os horários em que o chat estará online
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workingHours.map((hour) => (
                <div
                  key={hour.id}
                  className="flex items-center gap-4 p-3 rounded-lg border"
                >
                  <Switch
                    checked={hour.is_active}
                    onCheckedChange={(checked) =>
                      setWorkingHours(
                        workingHours.map((h) =>
                          h.id === hour.id ? { ...h, is_active: checked } : h
                        )
                      )
                    }
                  />
                  <span className="w-24 font-medium">
                    {dayNames[hour.day_of_week]}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={hour.start_time}
                      onChange={(e) =>
                        setWorkingHours(
                          workingHours.map((h) =>
                            h.id === hour.id ? { ...h, start_time: e.target.value } : h
                          )
                        )
                      }
                      disabled={!hour.is_active}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={hour.end_time}
                      onChange={(e) =>
                        setWorkingHours(
                          workingHours.map((h) =>
                            h.id === hour.id ? { ...h, end_time: e.target.value } : h
                          )
                        )
                      }
                      disabled={!hour.is_active}
                      className="w-32"
                    />
                  </div>
                </div>
              ))}

              <Button onClick={handleSaveHours} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Horários
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatSupportPage;
