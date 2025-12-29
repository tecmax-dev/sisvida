import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Search, 
  Save, 
  Trash2, 
  Users,
  Loader2,
  Shield,
  Lock,
  Calendar,
  FileText,
  Settings,
  CreditCard,
  Package,
  BarChart3,
  UserPlus,
  ClipboardList,
  Eye,
  Edit,
  Trash,
  Send,
  CheckCircle2,
  Info
} from "lucide-react";
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

interface PermissionDefinition {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  order_index: number;
}

interface AvailablePermission {
  permission_key: string;
  permission_name: string;
  category: string;
  feature_name: string | null;
}

interface AccessGroup {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  clinic_id: string | null;
  created_at: string;
}

interface GroupedPermissions {
  [category: string]: PermissionDefinition[];
}

// Map categories to friendly icons
const categoryIcons: Record<string, React.ReactNode> = {
  'Agendamento': <Calendar className="h-5 w-5" />,
  'Atendimento': <ClipboardList className="h-5 w-5" />,
  'Clientes': <Users className="h-5 w-5" />,
  'Cadastros Gerais': <FileText className="h-5 w-5" />,
  'Configurações': <Settings className="h-5 w-5" />,
  'Financeiro': <CreditCard className="h-5 w-5" />,
  'Caixa': <CreditCard className="h-5 w-5" />,
  'Análise': <BarChart3 className="h-5 w-5" />,
  'Dashboard': <BarChart3 className="h-5 w-5" />,
  'Consulta': <Eye className="h-5 w-5" />,
  'Catálogo': <Package className="h-5 w-5" />,
  'Profissionais': <UserPlus className="h-5 w-5" />,
  'Prontuário': <FileText className="h-5 w-5" />,
  'Marketing': <Send className="h-5 w-5" />,
  'Assinatura': <CreditCard className="h-5 w-5" />,
  'Estoque': <Package className="h-5 w-5" />,
  'Repasse': <CreditCard className="h-5 w-5" />,
  'TISS': <FileText className="h-5 w-5" />,
  'Anamnese': <ClipboardList className="h-5 w-5" />,
};

// Friendly category descriptions
const categoryDescriptions: Record<string, string> = {
  'Agendamento': 'Controle de acesso à agenda e lista de espera',
  'Atendimento': 'Gerenciamento da fila de atendimento',
  'Clientes': 'Cadastro e gestão de pacientes',
  'Cadastros Gerais': 'Configurações de anamnese, feriados, convênios, etc.',
  'Configurações': 'Configurações gerais do sistema',
  'Financeiro': 'Controle financeiro e transações',
  'Caixa': 'Abertura e fechamento de caixa',
  'Análise': 'Relatórios e fluxo de caixa',
  'Dashboard': 'Painéis de visualização',
  'Consulta': 'Consultas e visualizações de dados',
  'Catálogo': 'Produtos e serviços',
  'Profissionais': 'Gestão de profissionais',
  'Prontuário': 'Prontuário eletrônico',
  'Marketing': 'Campanhas e automações',
  'Assinatura': 'Gestão do plano',
  'Estoque': 'Controle de estoque',
  'Repasse': 'Repasse de comissões',
  'TISS': 'Guias e faturamento TISS',
  'Anamnese': 'Templates e respostas de anamnese',
};

// Permission action icons
const getPermissionIcon = (key: string) => {
  if (key.startsWith('view_') || key.includes('visualizar')) return <Eye className="h-4 w-4 text-blue-500" />;
  if (key.startsWith('manage_') || key.startsWith('edit_')) return <Edit className="h-4 w-4 text-amber-500" />;
  if (key.startsWith('delete_')) return <Trash className="h-4 w-4 text-red-500" />;
  if (key.startsWith('send_')) return <Send className="h-4 w-4 text-green-500" />;
  return <CheckCircle2 className="h-4 w-4 text-primary" />;
};

export default function AccessGroupsPage() {
  const { currentClinic, isSuperAdmin } = useAuth();
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<AccessGroup | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentClinic?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, permissionsRes] = await Promise.all([
        supabase
          .from('access_groups')
          .select('*')
          .order('is_system', { ascending: false })
          .order('name'),
        supabase
          .from('permission_definitions')
          .select('*')
          .eq('is_active', true)
          .order('category')
          .order('order_index')
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (permissionsRes.error) throw permissionsRes.error;

      setGroups(groupsRes.data || []);
      setPermissions(permissionsRes.data || []);
      
      // Fetch available permissions for the clinic's plan (if not super admin)
      if (currentClinic?.id && !isSuperAdmin) {
        const { data: availablePerms, error: availableError } = await supabase
          .rpc('get_available_permissions_for_clinic', { _clinic_id: currentClinic.id });
        
        if (availableError) {
          console.error('Error fetching available permissions:', availableError);
        } else {
          setAvailablePermissions(new Set((availablePerms || []).map((p: AvailablePermission) => p.permission_key)));
        }
      } else {
        // Super admin has access to all permissions
        setAvailablePermissions(new Set((permissionsRes.data || []).map(p => p.key)));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const groupedPermissions: GroupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as GroupedPermissions);

  const handleSelectGroup = async (group: AccessGroup) => {
    setSelectedGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || "");

    // Fetch group permissions
    const { data, error } = await supabase
      .from('access_group_permissions')
      .select('permission_key')
      .eq('access_group_id', group.id);

    if (error) {
      console.error('Error fetching group permissions:', error);
      toast.error('Erro ao carregar permissões do grupo');
      return;
    }

    setSelectedPermissions(new Set(data.map(p => p.permission_key)));
  };

  const handleNewGroup = () => {
    setSelectedGroup(null);
    setGroupName("");
    setGroupDescription("");
    setSelectedPermissions(new Set());
  };

  const handleTogglePermission = (permissionKey: string) => {
    // Only allow toggle if permission is available in the plan
    if (!availablePermissions.has(permissionKey)) return;
    
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionKey)) {
        newSet.delete(permissionKey);
      } else {
        newSet.add(permissionKey);
      }
      return newSet;
    });
  };

  const handleToggleCategory = (category: string, enable: boolean) => {
    const categoryPermissions = groupedPermissions[category];
    // Only consider available permissions
    const availableCategoryPerms = categoryPermissions.filter(p => availablePermissions.has(p.key));
    if (availableCategoryPerms.length === 0) return;
    
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      availableCategoryPerms.forEach(p => {
        if (enable) {
          newSet.add(p.key);
        } else {
          newSet.delete(p.key);
        }
      });
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }

    setSaving(true);
    try {
      let groupId = selectedGroup?.id;

      if (selectedGroup) {
        // Update existing group
        const { error } = await supabase
          .from('access_groups')
          .update({
            name: groupName.trim(),
            description: groupDescription.trim() || null,
          })
          .eq('id', selectedGroup.id);

        if (error) throw error;
      } else {
        // Create new group (global, for super admin)
        const { data, error } = await supabase
          .from('access_groups')
          .insert({
            name: groupName.trim(),
            description: groupDescription.trim() || null,
            clinic_id: null,
            is_system: false,
          })
          .select()
          .single();

        if (error) throw error;
        groupId = data.id;
      }

      // Update permissions
      // First, delete all existing permissions
      await supabase
        .from('access_group_permissions')
        .delete()
        .eq('access_group_id', groupId);

      // Then insert new permissions
      if (selectedPermissions.size > 0) {
        const permissionsToInsert = Array.from(selectedPermissions).map(key => ({
          access_group_id: groupId,
          permission_key: key,
        }));

        const { error: insertError } = await supabase
          .from('access_group_permissions')
          .insert(permissionsToInsert);

        if (insertError) throw insertError;
      }

      toast.success(selectedGroup ? 'Grupo atualizado com sucesso' : 'Grupo criado com sucesso');
      fetchData();
      
      if (!selectedGroup) {
        handleNewGroup();
      }
    } catch (error) {
      console.error('Error saving group:', error);
      toast.error('Erro ao salvar grupo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedGroup || selectedGroup.is_system) return;

    try {
      const { error } = await supabase
        .from('access_groups')
        .delete()
        .eq('id', selectedGroup.id);

      if (error) throw error;

      toast.success('Grupo excluído com sucesso');
      handleNewGroup();
      fetchData();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Erro ao excluir grupo');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryPermissionStats = (category: string) => {
    const categoryPerms = groupedPermissions[category] || [];
    const availableCategoryPerms = categoryPerms.filter(p => availablePermissions.has(p.key));
    const selectedCount = availableCategoryPerms.filter(p => selectedPermissions.has(p.key)).length;
    const unavailableCount = categoryPerms.length - availableCategoryPerms.length;
    const allSelected = availableCategoryPerms.length > 0 && selectedCount === availableCategoryPerms.length;
    return { selected: selectedCount, total: availableCategoryPerms.length, unavailable: unavailableCount, allSelected };
  };

  // Filter permissions by search
  const filteredCategories = Object.entries(groupedPermissions).filter(([category, perms]) => {
    if (!permissionSearch) return true;
    const searchLower = permissionSearch.toLowerCase();
    if (category.toLowerCase().includes(searchLower)) return true;
    return perms.some(p => 
      p.name.toLowerCase().includes(searchLower) || 
      p.description?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Grupos de Acesso</h1>
            <p className="text-sm text-muted-foreground">
              Configure quais funcionalidades cada perfil de usuário pode acessar
            </p>
          </div>
        </div>
        
        <Button onClick={handleNewGroup} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Grupo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-1">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Grupos Cadastrados
              </CardTitle>
              <CardDescription>
                Selecione um grupo para editar
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar grupo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              </div>
              <Separator />
              <ScrollArea className="h-[400px]">
                <div className="divide-y divide-border">
                  {filteredGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleSelectGroup(group)}
                      className={`w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors ${
                        selectedGroup?.id === group.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${selectedGroup?.id === group.id ? 'bg-primary/20' : 'bg-muted'}`}>
                          <Users className="h-3.5 w-3.5 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm block truncate">{group.name}</span>
                          {group.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {group.description}
                            </p>
                          )}
                        </div>
                        {group.is_system && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Padrão
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                  {filteredGroups.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum grupo encontrado
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Form and Permissions */}
        <div className="lg:col-span-3 space-y-4">
          {/* Group Form */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                {selectedGroup ? 'Editar Grupo' : 'Novo Grupo'}
              </CardTitle>
              <CardDescription>
                Defina um nome e descrição para identificar este grupo de usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName">Nome do Grupo *</Label>
                  <Input
                    id="groupName"
                    placeholder="Ex: Recepcionistas, Médicos, Administradores..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupDescription">Descrição</Label>
                  <Input
                    id="groupDescription"
                    placeholder="Breve descrição das responsabilidades..."
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissions Section */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Permissões do Grupo
                  </CardTitle>
                  <CardDescription>
                    Ative ou desative as funcionalidades que este grupo pode acessar
                  </CardDescription>
                </div>
                <Badge variant="outline" className="self-start sm:self-auto">
                  {selectedPermissions.size} permissões ativas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Permission search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar permissão..."
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p><strong>Como funciona:</strong> Use o interruptor de cada categoria para ativar/desativar todas as permissões de uma vez, ou marque permissões individuais abaixo de cada categoria.</p>
                </div>
              </div>

              {/* Categories Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredCategories.map(([category, categoryPermissions]) => {
                  const stats = categoryPermissionStats(category);
                  const hasUnavailable = stats.unavailable > 0;
                  const icon = categoryIcons[category] || <Shield className="h-5 w-5" />;
                  const description = categoryDescriptions[category] || '';

                  // Filter permissions by search within category
                  const filteredPerms = permissionSearch
                    ? categoryPermissions.filter(p => 
                        p.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                        p.description?.toLowerCase().includes(permissionSearch.toLowerCase())
                      )
                    : categoryPermissions;

                  if (filteredPerms.length === 0 && permissionSearch) return null;

                  return (
                    <Card key={category} className="overflow-hidden">
                      {/* Category Header */}
                      <div className="p-4 bg-muted/30 border-b">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-background shadow-sm">
                              {icon}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm truncate">{category}</h3>
                              {description && (
                                <p className="text-xs text-muted-foreground truncate">{description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {hasUnavailable && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{stats.unavailable} permissão(ões) requer upgrade do plano</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {stats.selected}/{stats.total}
                              </span>
                              <Switch
                                checked={stats.allSelected}
                                onCheckedChange={(checked) => handleToggleCategory(category, checked)}
                                disabled={stats.total === 0}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Permissions List */}
                      <div className="p-4 space-y-3">
                        {(filteredPerms.length > 0 ? filteredPerms : categoryPermissions).map((perm) => {
                          const isAvailable = availablePermissions.has(perm.key);
                          const isSelected = selectedPermissions.has(perm.key);
                          
                          return (
                            <div 
                              key={perm.id} 
                              className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                                isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                              } ${!isAvailable ? 'opacity-50' : ''}`}
                            >
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Checkbox
                                        id={perm.key}
                                        checked={isSelected}
                                        onCheckedChange={() => handleTogglePermission(perm.key)}
                                        disabled={!isAvailable}
                                        className="mt-0.5"
                                      />
                                    </span>
                                  </TooltipTrigger>
                                  {!isAvailable && (
                                    <TooltipContent>
                                      <p>Requer upgrade do plano</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                              <div className="flex-1 min-w-0">
                                <Label
                                  htmlFor={perm.key}
                                  className={`text-sm font-medium flex items-center gap-2 ${
                                    isAvailable ? 'cursor-pointer' : 'cursor-not-allowed'
                                  }`}
                                >
                                  {getPermissionIcon(perm.key)}
                                  <span className="truncate">{perm.name}</span>
                                  {!isAvailable && (
                                    <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                                  )}
                                </Label>
                                {perm.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {perm.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            {selectedGroup && !selectedGroup.is_system && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Grupo
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleNewGroup}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo Grupo
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !groupName.trim()}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Grupo de Acesso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o grupo "{selectedGroup?.name}"? 
              Esta ação não pode ser desfeita e os usuários vinculados a este grupo 
              perderão suas permissões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
