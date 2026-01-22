import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PopupBase,
  PopupHeader,
  PopupTitle,
  PopupDescription,
  PopupFooter,
} from "@/components/ui/popup-base";
import { AlertPopup } from "@/components/ui/alert-popup";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Key, Plus, Copy, Eye, EyeOff, Trash2, RefreshCw, 
  Clock, CheckCircle, XCircle, Code, ExternalLink 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ApiKey {
  id: string;
  name: string;
  api_key_preview: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

interface ApiKeysPanelProps {
  clinicId: string;
}

const ALL_PERMISSIONS = [
  { id: 'read:professionals', label: 'Listar profissionais', description: 'Ver lista de profissionais ativos' },
  { id: 'read:availability', label: 'Ver disponibilidade', description: 'Consultar horários disponíveis' },
  { id: 'read:patients', label: 'Buscar pacientes', description: 'Pesquisar pacientes por telefone/CPF' },
  { id: 'create:patients', label: 'Criar pacientes', description: 'Cadastrar novos pacientes' },
  { id: 'read:appointments', label: 'Listar agendamentos', description: 'Ver lista de agendamentos' },
  { id: 'create:appointments', label: 'Criar agendamentos', description: 'Criar novos agendamentos' },
  { id: 'cancel:appointments', label: 'Cancelar agendamentos', description: 'Cancelar agendamentos existentes' },
  { id: 'read:history', label: 'Ver histórico', description: 'Consultar histórico do paciente' },
];

// Gerar API key aleatória
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'sk_live_';
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Hash SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function ApiKeysPanel({ clinicId }: ApiKeysPanelProps) {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(ALL_PERMISSIONS.map(p => p.id));
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);

  // Carregar API keys
  const loadApiKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, api_key_preview, permissions, is_active, created_at, last_used_at, expires_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading API keys:', error);
      toast({
        title: "Erro ao carregar chaves",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setApiKeys((data || []).map(key => ({
        ...key,
        permissions: Array.isArray(key.permissions) 
          ? (key.permissions as unknown as string[]) 
          : [],
        is_active: key.is_active ?? true,
        last_used_at: key.last_used_at ?? null,
        expires_at: key.expires_at ?? null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadApiKeys();
  }, [clinicId]);

  // Criar nova API key
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para identificar esta chave.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const preview = rawKey.slice(-8);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('api_keys')
      .insert({
        clinic_id: clinicId,
        name: newKeyName.trim(),
        api_key_hash: keyHash,
        api_key_preview: preview,
        permissions: newKeyPermissions,
        created_by: userData.user?.id,
      });

    if (error) {
      toast({
        title: "Erro ao criar chave",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCreatedKey(rawKey);
      setShowCreatedKey(true);
      setNewKeyName("");
      setNewKeyPermissions(ALL_PERMISSIONS.map(p => p.id));
      loadApiKeys();
      toast({
        title: "Chave criada com sucesso",
        description: "Copie a chave agora. Ela não será exibida novamente.",
      });
    }
    setCreating(false);
  };

  // Toggle status da key
  const handleToggleStatus = async (keyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: !currentStatus })
      .eq('id', keyId);

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      loadApiKeys();
      toast({
        title: !currentStatus ? "Chave ativada" : "Chave desativada",
      });
    }
  };

  // Deletar key
  const handleDeleteKey = async () => {
    if (!deleteKeyId) return;

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', deleteKeyId);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      loadApiKeys();
      toast({
        title: "Chave excluída",
      });
    }
    setDeleteKeyId(null);
  };

  // Copiar chave
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const apiBaseUrl = `${window.location.origin.replace('localhost:8080', 'eahhszmbyxapxzilfdlo.supabase.co')}/functions/v1/clinic-api`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Integrações API</CardTitle>
              <CardDescription>
                Gerencie chaves de API para integração com sistemas externos
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDocsOpen(true)}>
              <Code className="h-4 w-4 mr-2" />
              Documentação
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Chave
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhuma chave de API criada</p>
            <p className="text-sm">Crie uma chave para permitir integrações externas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className={`p-4 rounded-lg border ${
                  key.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{key.name}</span>
                      {key.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inativa
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="font-mono">sk_live_...{key.api_key_preview}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {key.last_used_at 
                          ? `Usado ${formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true, locale: ptBR })}`
                          : 'Nunca usado'
                        }
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {key.permissions.slice(0, 4).map(p => (
                        <Badge key={p} variant="secondary" className="text-xs">
                          {ALL_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                        </Badge>
                      ))}
                      {key.permissions.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{key.permissions.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={key.is_active}
                      onCheckedChange={() => handleToggleStatus(key.id, key.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteKeyId(key.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog Criar Chave */}
        <PopupBase open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md">
          <PopupHeader>
            <PopupTitle>Criar Nova Chave de API</PopupTitle>
            <PopupDescription>
              Defina um nome e as permissões para esta chave
            </PopupDescription>
          </PopupHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Nome da Chave</Label>
              <Input
                id="keyName"
                placeholder="Ex: Sistema de Agendamento"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissões</Label>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {ALL_PERMISSIONS.map((perm) => (
                  <div key={perm.id} className="flex items-start gap-2">
                    <Checkbox
                      id={perm.id}
                      checked={newKeyPermissions.includes(perm.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewKeyPermissions([...newKeyPermissions, perm.id]);
                        } else {
                          setNewKeyPermissions(newKeyPermissions.filter(p => p !== perm.id));
                        }
                      }}
                    />
                    <label htmlFor={perm.id} className="text-sm cursor-pointer">
                      <div className="font-medium">{perm.label}</div>
                      <div className="text-muted-foreground text-xs">{perm.description}</div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <PopupFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateKey} disabled={creating}>
              {creating ? "Criando..." : "Criar Chave"}
            </Button>
          </PopupFooter>
        </PopupBase>

        {/* Dialog Chave Criada */}
        <PopupBase open={!!createdKey} onClose={() => setCreatedKey(null)} maxWidth="lg">
          <PopupHeader>
            <PopupTitle>Chave Criada com Sucesso</PopupTitle>
            <PopupDescription>
              Copie esta chave agora. Por segurança, ela não será exibida novamente.
            </PopupDescription>
          </PopupHeader>
          <div className="py-4">
            <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all flex items-center gap-2">
              <span className="flex-1">
                {showCreatedKey ? createdKey : '•'.repeat(60)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreatedKey(!showCreatedKey)}
              >
                {showCreatedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => createdKey && copyToClipboard(createdKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <PopupFooter>
            <Button onClick={() => setCreatedKey(null)}>Fechar</Button>
          </PopupFooter>
        </PopupBase>

        {/* Dialog Confirmar Exclusão */}
        <AlertPopup
          open={!!deleteKeyId}
          onClose={() => setDeleteKeyId(null)}
          onConfirm={handleDeleteKey}
          title="Excluir Chave de API?"
          description="Esta ação não pode ser desfeita. Sistemas que utilizam esta chave perderão acesso imediatamente."
          confirmText="Excluir"
          confirmVariant="destructive"
        />

        {/* Dialog Documentação */}
        <PopupBase open={docsOpen} onClose={() => setDocsOpen(false)} maxWidth="2xl">
          <PopupHeader>
            <PopupTitle>Documentação da API</PopupTitle>
            <PopupDescription>
              Referência completa dos endpoints disponíveis
            </PopupDescription>
          </PopupHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground">Base URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm flex-1 break-all">{apiBaseUrl}</code>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(apiBaseUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground">Autenticação</Label>
              <code className="text-sm block mt-1">Header: X-API-Key: sua_chave_aqui</code>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="professionals">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">GET</Badge>
                    /professionals
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-2">Lista todos os profissionais ativos da clínica.</p>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`curl -X GET "${apiBaseUrl}/professionals" \\
  -H "X-API-Key: sua_chave"`}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="availability">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">GET</Badge>
                    /professionals/:id/availability
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-2">Retorna horários disponíveis do profissional.</p>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`curl -X GET "${apiBaseUrl}/professionals/uuid/availability?date=2024-12-25" \\
  -H "X-API-Key: sua_chave"`}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="patients-search">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">GET</Badge>
                    /patients
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-2">Busca pacientes por telefone, CPF ou nome.</p>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`curl -X GET "${apiBaseUrl}/patients?phone=71999887766" \\
  -H "X-API-Key: sua_chave"`}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="patients-create">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">POST</Badge>
                    /patients
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-2">Cadastra um novo paciente.</p>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`curl -X POST "${apiBaseUrl}/patients" \\
  -H "X-API-Key: sua_chave" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "João Silva",
    "phone": "71999887766",
    "email": "joao@email.com",
    "cpf": "123.456.789-00"
  }'`}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="appointments-create">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">POST</Badge>
                    /appointments
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-2">Cria um novo agendamento. Pode criar o paciente automaticamente.</p>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`curl -X POST "${apiBaseUrl}/appointments" \\
  -H "X-API-Key: sua_chave" \\
  -H "Content-Type: application/json" \\
  -d '{
    "patient_name": "João Silva",
    "patient_phone": "71999887766",
    "professional_id": "uuid-do-profissional",
    "appointment_date": "2024-12-25",
    "start_time": "09:00",
    "type": "first_visit"
  }'`}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="appointments-list">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">GET</Badge>
                    /appointments
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-2">Lista agendamentos com filtros opcionais.</p>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`curl -X GET "${apiBaseUrl}/appointments?date=2024-12-25&status=scheduled" \\
  -H "X-API-Key: sua_chave"`}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="appointments-cancel">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge className="bg-amber-500">PATCH</Badge>
                    /appointments/:id/cancel
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-2">Cancela um agendamento existente.</p>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`curl -X PATCH "${apiBaseUrl}/appointments/uuid/cancel" \\
  -H "X-API-Key: sua_chave" \\
  -H "Content-Type: application/json" \\
  -d '{"cancellation_reason": "Solicitado pelo paciente"}'`}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="history">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">GET</Badge>
                    /patients/:id/history
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-2">Retorna o histórico de agendamentos do paciente.</p>
                  <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
{`curl -X GET "${apiBaseUrl}/patients/uuid/history" \\
  -H "X-API-Key: sua_chave"`}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </PopupBase>
      </CardContent>
    </Card>
  );
}
