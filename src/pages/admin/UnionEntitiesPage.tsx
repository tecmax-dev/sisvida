import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Building2, 
  Plus, 
  Search, 
  Edit, 
  MoreHorizontal,
  Check,
  X,
  Key,
  RefreshCw,
  Loader2,
  Clock,
  Users,
  AlertTriangle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { CnpjInputCard } from "@/components/ui/cnpj-input-card";

interface UnionEntity {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  entity_type: 'sindicato' | 'federacao' | 'confederacao';
  categoria_laboral: string | null;
  abrangencia: 'municipal' | 'estadual' | 'nacional' | null;
  user_id: string | null;
  email_institucional: string;
  responsavel_legal: string | null;
  telefone: string | null;
  email_contato: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  plan_id: string | null;
  clinic_id: string | null;
  status: 'ativa' | 'suspensa' | 'em_analise' | 'inativa';
  data_ativacao: string | null;
  ultimo_acesso: string | null;
  created_at: string;
  updated_at: string;
}

interface Plan {
  id: string;
  name: string;
  category: string;
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
}

const entityTypeLabels = {
  sindicato: 'Sindicato',
  federacao: 'Federação',
  confederacao: 'Confederação'
};

const statusLabels = {
  ativa: 'Ativa',
  suspensa: 'Suspensa',
  em_analise: 'Em Análise',
  inativa: 'Inativa'
};

const statusColors = {
  ativa: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  suspensa: 'bg-amber-100 text-amber-700 border-amber-200',
  em_analise: 'bg-blue-100 text-blue-700 border-blue-200',
  inativa: 'bg-slate-100 text-slate-700 border-slate-200'
};

const coverageLabels = {
  municipal: 'Municipal',
  estadual: 'Estadual',
  nacional: 'Nacional'
};

export default function UnionEntitiesPage() {
  const { user } = useAuth();
  const { lookupCnpj, cnpjLoading } = useCnpjLookup();
  const [entities, setEntities] = useState<UnionEntity[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<UnionEntity | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    entity_type: 'sindicato' as 'sindicato' | 'federacao' | 'confederacao',
    categoria_laboral: '',
    abrangencia: 'municipal' as 'municipal' | 'estadual' | 'nacional',
    email_institucional: '',
    password: '',
    responsavel_legal: '',
    telefone: '',
    email_contato: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    plan_id: '',
    clinic_id: '',
    status: 'em_analise' as 'ativa' | 'suspensa' | 'em_analise' | 'inativa'
  });

  useEffect(() => {
    fetchEntities();
    fetchPlans();
    fetchClinics();
  }, []);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('union_entities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntities(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar entidades: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, category')
        .eq('category', 'sindicato')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchClinics = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug')
        .order('name');

      if (error) throw error;
      setClinics(data || []);
    } catch (error: any) {
      console.error('Error fetching clinics:', error);
    }
  };

  const handleCnpjLookup = async () => {
    const cnpjData = await lookupCnpj(formData.cnpj);
    if (cnpjData) {
      setFormData(prev => ({
        ...prev,
        razao_social: cnpjData.razao_social || prev.razao_social,
        nome_fantasia: cnpjData.nome_fantasia || prev.nome_fantasia,
        endereco: cnpjData.logradouro 
          ? `${cnpjData.logradouro}${cnpjData.numero ? ', ' + cnpjData.numero : ''}`
          : prev.endereco,
        cidade: cnpjData.municipio || prev.cidade,
        estado: cnpjData.uf || prev.estado,
        cep: cnpjData.cep || prev.cep,
        telefone: cnpjData.telefone || prev.telefone,
        email_contato: cnpjData.email || prev.email_contato
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      entity_type: 'sindicato',
      categoria_laboral: '',
      abrangencia: 'municipal',
      email_institucional: '',
      password: '',
      responsavel_legal: '',
      telefone: '',
      email_contato: '',
      endereco: '',
      cidade: '',
      estado: '',
      cep: '',
      plan_id: '',
      clinic_id: '',
      status: 'em_analise'
    });
    setEditingEntity(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (entity: UnionEntity) => {
    setEditingEntity(entity);
    setFormData({
      razao_social: entity.razao_social,
      nome_fantasia: entity.nome_fantasia || '',
      cnpj: entity.cnpj,
      entity_type: entity.entity_type,
      categoria_laboral: entity.categoria_laboral || '',
      abrangencia: entity.abrangencia || 'municipal',
      email_institucional: entity.email_institucional,
      password: '',
      responsavel_legal: entity.responsavel_legal || '',
      telefone: entity.telefone || '',
      email_contato: entity.email_contato || '',
      endereco: entity.endereco || '',
      cidade: entity.cidade || '',
      estado: entity.estado || '',
      cep: entity.cep || '',
      plan_id: entity.plan_id || '',
      clinic_id: entity.clinic_id || '',
      status: entity.status
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.razao_social || !formData.cnpj || !formData.email_institucional) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      if (editingEntity) {
        // Update existing entity
        const { error } = await supabase
          .from('union_entities')
          .update({
            razao_social: formData.razao_social,
            nome_fantasia: formData.nome_fantasia || null,
            cnpj: formData.cnpj,
            entity_type: formData.entity_type,
            categoria_laboral: formData.categoria_laboral || null,
            abrangencia: formData.abrangencia,
            email_institucional: formData.email_institucional,
            responsavel_legal: formData.responsavel_legal || null,
            telefone: formData.telefone || null,
            email_contato: formData.email_contato || null,
            endereco: formData.endereco || null,
            cidade: formData.cidade || null,
            estado: formData.estado || null,
            cep: formData.cep || null,
            plan_id: formData.plan_id || null,
            clinic_id: formData.clinic_id || null,
            status: formData.status,
            data_ativacao: formData.status === 'ativa' && !editingEntity.data_ativacao 
              ? new Date().toISOString() 
              : editingEntity.data_ativacao
          })
          .eq('id', editingEntity.id);

        if (error) throw error;
        toast.success('Entidade atualizada com sucesso');
      } else {
        // Create new entity with auth user
        if (!formData.password) {
          toast.error('Senha é obrigatória para nova entidade');
          return;
        }

        // Create the auth user via dedicated edge function for union entities
        const { data: authData, error: authError } = await supabase.functions.invoke('create-union-entity-user', {
          body: {
            email: formData.email_institucional,
            password: formData.password,
            name: formData.razao_social
          }
        });

        if (authError) throw authError;

        // Then create the entity
        const { error } = await supabase
          .from('union_entities')
          .insert({
            razao_social: formData.razao_social,
            nome_fantasia: formData.nome_fantasia || null,
            cnpj: formData.cnpj,
            entity_type: formData.entity_type,
            categoria_laboral: formData.categoria_laboral || null,
            abrangencia: formData.abrangencia,
            user_id: authData.user?.id || null,
            email_institucional: formData.email_institucional,
            responsavel_legal: formData.responsavel_legal || null,
            telefone: formData.telefone || null,
            email_contato: formData.email_contato || null,
            endereco: formData.endereco || null,
            cidade: formData.cidade || null,
            estado: formData.estado || null,
            cep: formData.cep || null,
            plan_id: formData.plan_id || null,
            clinic_id: formData.clinic_id || null,
            status: formData.status,
            data_ativacao: formData.status === 'ativa' ? new Date().toISOString() : null,
            created_by: user?.id
          });

        if (error) throw error;

        // Note: Role assignment is handled by existing clinic user creation flow
        // The entidade_sindical_admin role is assigned via the union_entities table link

        toast.success('Entidade criada com sucesso');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEntities();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (entity: UnionEntity, newStatus: 'ativa' | 'suspensa' | 'em_analise' | 'inativa') => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'ativa' && !entity.data_ativacao) {
        updates.data_ativacao = new Date().toISOString();
      }

      const { error } = await supabase
        .from('union_entities')
        .update(updates)
        .eq('id', entity.id);

      if (error) throw error;
      toast.success(`Status alterado para ${statusLabels[newStatus]}`);
      fetchEntities();
    } catch (error: any) {
      toast.error('Erro ao alterar status: ' + error.message);
    }
  };

  const handleResetPassword = async (entity: UnionEntity) => {
    if (!entity.user_id) {
      toast.error('Entidade não possui usuário vinculado');
      return;
    }

    const newPassword = prompt('Digite a nova senha (mínimo 6 caracteres):');
    if (!newPassword || newPassword.length < 6) {
      toast.error('Senha inválida');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('update-user-password', {
        body: {
          userId: entity.user_id,
          newPassword
        }
      });

      if (error) throw error;
      toast.success('Senha resetada com sucesso');
    } catch (error: any) {
      toast.error('Erro ao resetar senha: ' + error.message);
    }
  };

  const filteredEntities = entities.filter(entity => {
    const search = searchTerm.toLowerCase();
    return (
      entity.razao_social.toLowerCase().includes(search) ||
      entity.cnpj.includes(search) ||
      entity.email_institucional.toLowerCase().includes(search) ||
      (entity.nome_fantasia && entity.nome_fantasia.toLowerCase().includes(search))
    );
  });

  const stats = {
    total: entities.length,
    ativas: entities.filter(e => e.status === 'ativa').length,
    suspensas: entities.filter(e => e.status === 'suspensa').length,
    emAnalise: entities.filter(e => e.status === 'em_analise').length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Entidades Sindicais
          </h1>
          <p className="text-muted-foreground">
            Gestão de contas de sindicatos, federações e confederações
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Entidade
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600">Ativas</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.ativas}</p>
              </div>
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">Suspensas</p>
                <p className="text-2xl font-bold text-amber-700">{stats.suspensas}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Em Análise</p>
                <p className="text-2xl font-bold text-blue-700">{stats.emAnalise}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por razão social, CNPJ ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchEntities}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhuma entidade encontrada' : 'Nenhuma entidade cadastrada'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidade</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Último Acesso</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntities.map((entity) => {
                  const plan = plans.find(p => p.id === entity.plan_id);
                  return (
                    <TableRow key={entity.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{entity.razao_social}</p>
                          {entity.nome_fantasia && (
                            <p className="text-sm text-muted-foreground">{entity.nome_fantasia}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{entity.email_institucional}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{entity.cnpj}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {entityTypeLabels[entity.entity_type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {plan ? plan.name : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[entity.status]}>
                          {statusLabels[entity.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(entity.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entity.ultimo_acesso 
                          ? format(new Date(entity.ultimo_acesso), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : <span className="text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(entity)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(entity)}>
                              <Key className="h-4 w-4 mr-2" />
                              Resetar Senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {entity.status !== 'ativa' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(entity, 'ativa')}>
                                <Check className="h-4 w-4 mr-2 text-emerald-600" />
                                Ativar
                              </DropdownMenuItem>
                            )}
                            {entity.status !== 'suspensa' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(entity, 'suspensa')}>
                                <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
                                Suspender
                              </DropdownMenuItem>
                            )}
                            {entity.status !== 'inativa' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(entity, 'inativa')}>
                                <X className="h-4 w-4 mr-2 text-red-600" />
                                Desativar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntity ? 'Editar Entidade Sindical' : 'Nova Entidade Sindical'}
            </DialogTitle>
            <DialogDescription>
              {editingEntity ? 'Atualize os dados da entidade' : 'Cadastre uma nova entidade sindical'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Entity Data */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Dados da Entidade
              </h3>
              
              <CnpjInputCard
                value={formData.cnpj}
                onChange={(value) => setFormData(prev => ({ ...prev, cnpj: value }))}
                onLookup={handleCnpjLookup}
                loading={cnpjLoading}
                required
                label="CNPJ da Entidade"
                showLookupButton
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entity_type">Tipo de Entidade *</Label>
                  <Select
                    value={formData.entity_type}
                    onValueChange={(value: 'sindicato' | 'federacao' | 'confederacao') => 
                      setFormData(prev => ({ ...prev, entity_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sindicato">Sindicato</SelectItem>
                      <SelectItem value="federacao">Federação</SelectItem>
                      <SelectItem value="confederacao">Confederação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abrangencia">Abrangência *</Label>
                  <Select
                    value={formData.abrangencia}
                    onValueChange={(value: 'municipal' | 'estadual' | 'nacional') => 
                      setFormData(prev => ({ ...prev, abrangencia: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="municipal">Municipal</SelectItem>
                      <SelectItem value="estadual">Estadual</SelectItem>
                      <SelectItem value="nacional">Nacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="razao_social">Razão Social *</Label>
                  <Input
                    id="razao_social"
                    value={formData.razao_social}
                    onChange={(e) => setFormData(prev => ({ ...prev, razao_social: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input
                    id="nome_fantasia"
                    value={formData.nome_fantasia}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome_fantasia: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria_laboral">Categoria Laboral Representada</Label>
                <Input
                  id="categoria_laboral"
                  value={formData.categoria_laboral}
                  onChange={(e) => setFormData(prev => ({ ...prev, categoria_laboral: e.target.value }))}
                  placeholder="Ex: Metalúrgicos, Comerciários, Trabalhadores da Construção Civil"
                />
              </div>
            </div>

            {/* Access Data */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Dados de Acesso
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email_institucional">E-mail Institucional (Login) *</Label>
                  <Input
                    id="email_institucional"
                    type="email"
                    value={formData.email_institucional}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_institucional: e.target.value }))}
                    disabled={!!editingEntity}
                  />
                </div>
                {!editingEntity && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="status">Status da Conta</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'ativa' | 'suspensa' | 'em_analise' | 'inativa') => 
                      setFormData(prev => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_analise">Em Análise</SelectItem>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="suspensa">Suspensa</SelectItem>
                      <SelectItem value="inativa">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan_id">Plano Contratado</Label>
                  <Select
                    value={formData.plan_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, plan_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Clinic Link */}
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="clinic_id">Clínica Vinculada (Dados de Empresas/Contribuições)</Label>
                  <Select
                    value={formData.clinic_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, clinic_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma clínica para vincular os dados" />
                    </SelectTrigger>
                    <SelectContent>
                      {clinics.map(clinic => (
                        <SelectItem key={clinic.id} value={clinic.id}>
                          {clinic.name} ({clinic.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    A clínica vinculada determina quais empresas, contribuições e dados financeiros a entidade terá acesso.
                  </p>
                </div>
              </div>
            </div>

            {/* Administrative Data */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Dados Administrativos
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsavel_legal">Responsável Legal</Label>
                  <Input
                    id="responsavel_legal"
                    value={formData.responsavel_legal}
                    onChange={(e) => setFormData(prev => ({ ...prev, responsavel_legal: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_contato">E-mail de Contato</Label>
                <Input
                  id="email_contato"
                  type="email"
                  value={formData.email_contato}
                  onChange={(e) => setFormData(prev => ({ ...prev, email_contato: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Textarea
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEntity ? 'Salvar Alterações' : 'Criar Entidade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
