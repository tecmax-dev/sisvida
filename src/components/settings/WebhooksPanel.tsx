import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface WebhookLog {
  id: string;
  event: string;
  response_status: number | null;
  error: string | null;
  duration_ms: number | null;
  delivered_at: string;
}

const AVAILABLE_EVENTS = [
  { id: 'appointment.created', label: 'Agendamento Criado', description: 'Quando um novo agendamento é criado' },
  { id: 'appointment.confirmed', label: 'Agendamento Confirmado', description: 'Quando um agendamento é confirmado' },
  { id: 'appointment.cancelled', label: 'Agendamento Cancelado', description: 'Quando um agendamento é cancelado' },
  { id: 'appointment.completed', label: 'Atendimento Concluído', description: 'Quando um atendimento é finalizado' },
  { id: 'patient.created', label: 'Paciente Cadastrado', description: 'Quando um novo paciente é cadastrado' },
];

export function WebhooksPanel() {
  const { currentClinic } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, WebhookLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentClinic?.id) {
      loadWebhooks();
    }
  }, [currentClinic?.id]);

  async function loadWebhooks() {
    if (!currentClinic?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('clinic_id', currentClinic.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading webhooks:', error);
      toast.error('Erro ao carregar webhooks');
    } else {
      setWebhooks(data || []);
    }
    setLoading(false);
  }

  async function loadLogs(webhookId: string) {
    setLoadingLogs(webhookId);
    
    const { data, error } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('delivered_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('Error loading logs:', error);
      toast.error('Erro ao carregar logs');
    } else {
      setLogs(prev => ({ ...prev, [webhookId]: data || [] }));
    }
    setLoadingLogs(null);
  }

  function openCreateDialog() {
    setSelectedWebhook(null);
    setFormData({ name: '', url: '', secret: '', events: [] });
    setShowDialog(true);
  }

  function openEditDialog(webhook: WebhookConfig) {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || '',
      events: webhook.events,
    });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!currentClinic?.id) return;
    
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error('Nome e URL são obrigatórios');
      return;
    }
    
    if (formData.events.length === 0) {
      toast.error('Selecione pelo menos um evento');
      return;
    }
    
    // Validate URL
    try {
      new URL(formData.url);
    } catch {
      toast.error('URL inválida');
      return;
    }
    
    setSaving(true);
    
    const webhookData = {
      clinic_id: currentClinic.id,
      name: formData.name.trim(),
      url: formData.url.trim(),
      secret: formData.secret.trim() || null,
      events: formData.events,
    };
    
    if (selectedWebhook) {
      const { error } = await supabase
        .from('webhooks')
        .update(webhookData)
        .eq('id', selectedWebhook.id);
      
      if (error) {
        toast.error('Erro ao atualizar webhook');
      } else {
        toast.success('Webhook atualizado!');
        setShowDialog(false);
        loadWebhooks();
      }
    } else {
      const { error } = await supabase
        .from('webhooks')
        .insert(webhookData);
      
      if (error) {
        toast.error('Erro ao criar webhook');
      } else {
        toast.success('Webhook criado!');
        setShowDialog(false);
        loadWebhooks();
      }
    }
    
    setSaving(false);
  }

  async function handleToggleActive(webhook: WebhookConfig) {
    const { error } = await supabase
      .from('webhooks')
      .update({ is_active: !webhook.is_active })
      .eq('id', webhook.id);
    
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success(webhook.is_active ? 'Webhook desativado' : 'Webhook ativado');
      loadWebhooks();
    }
  }

  async function handleDelete() {
    if (!selectedWebhook) return;
    
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', selectedWebhook.id);
    
    if (error) {
      toast.error('Erro ao excluir webhook');
    } else {
      toast.success('Webhook excluído');
      setShowDeleteDialog(false);
      setSelectedWebhook(null);
      loadWebhooks();
    }
  }

  function toggleEvent(eventId: string) {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  }

  function generateSecret() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    setFormData(prev => ({ ...prev, secret }));
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  }

  function toggleLogs(webhookId: string) {
    if (expandedLogs === webhookId) {
      setExpandedLogs(null);
    } else {
      setExpandedLogs(webhookId);
      if (!logs[webhookId]) {
        loadLogs(webhookId);
      }
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks
              </CardTitle>
              <CardDescription>
                Configure notificações automáticas para sistemas externos
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum webhook configurado</p>
              <p className="text-sm">Crie um webhook para notificar sistemas externos sobre eventos</p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <Collapsible
                  key={webhook.id}
                  open={expandedLogs === webhook.id}
                  onOpenChange={(open) => {
                    if (open) {
                      setExpandedLogs(webhook.id);
                      if (!logs[webhook.id]) {
                        loadLogs(webhook.id);
                      }
                    } else {
                      setExpandedLogs(null);
                    }
                  }}
                >
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={webhook.is_active}
                          onCheckedChange={() => handleToggleActive(webhook)}
                        />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {webhook.name}
                            {webhook.secret && (
                              <Badge variant="outline" className="text-xs">
                                Assinado
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            {webhook.url}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {expandedLogs === webhook.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="ml-1">Logs</span>
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(webhook)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedWebhook(webhook);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      {webhook.events.map(event => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {AVAILABLE_EVENTS.find(e => e.id === event)?.label || event}
                        </Badge>
                      ))}
                    </div>
                    
                    <CollapsibleContent>
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Histórico de Entregas</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadLogs(webhook.id)}
                            disabled={loadingLogs === webhook.id}
                          >
                            <RefreshCw className={`h-4 w-4 ${loadingLogs === webhook.id ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                        
                        {loadingLogs === webhook.id ? (
                          <div className="flex justify-center py-4">
                            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : logs[webhook.id]?.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma entrega registrada
                          </p>
                        ) : (
                          <ScrollArea className="h-48">
                            <div className="space-y-2">
                              {logs[webhook.id]?.map(log => (
                                <div
                                  key={log.id}
                                  className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                                >
                                  <div className="flex items-center gap-2">
                                    {log.response_status && log.response_status < 400 ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                      {AVAILABLE_EVENTS.find(e => e.id === log.event)?.label || log.event}
                                    </Badge>
                                    {log.response_status && (
                                      <span className="text-muted-foreground">
                                        HTTP {log.response_status}
                                      </span>
                                    )}
                                    {log.error && (
                                      <span className="text-destructive text-xs">
                                        {log.error}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                    {log.duration_ms && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {log.duration_ms}ms
                                      </span>
                                    )}
                                    <span>
                                      {new Date(log.delivered_at).toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedWebhook ? 'Editar Webhook' : 'Novo Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure a URL e os eventos que dispararão notificações
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Sistema de Marketing"
              />
            </div>
            
            <div>
              <Label htmlFor="url">URL do Webhook</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://exemplo.com/webhook"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="secret">Secret (opcional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateSecret}
                >
                  Gerar
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="secret"
                  type={showSecret ? 'text' : 'password'}
                  value={formData.secret}
                  onChange={e => setFormData(prev => ({ ...prev, secret: e.target.value }))}
                  placeholder="Chave para assinatura HMAC-SHA256"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {formData.secret && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(formData.secret)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                O secret será usado para assinar os payloads com HMAC-SHA256
              </p>
            </div>
            
            <div>
              <Label>Eventos</Label>
              <div className="mt-2 space-y-2">
                {AVAILABLE_EVENTS.map(event => (
                  <label
                    key={event.id}
                    className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={formData.events.includes(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                    />
                    <div>
                      <div className="font-medium text-sm">{event.label}</div>
                      <div className="text-xs text-muted-foreground">{event.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o webhook "{selectedWebhook?.name}"?
              Esta ação não pode ser desfeita e todo o histórico de entregas será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
