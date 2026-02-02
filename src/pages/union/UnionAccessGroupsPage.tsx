import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
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
  Info,
  Building2,
  Building,
  ShieldCheck,
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
  module_type: string;
}

interface AccessGroup {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  clinic_id: string | null;
  module_type: string;
  created_at: string;
}

interface GroupedPermissions {
  [category: string]: PermissionDefinition[];
}

// Map categories to friendly icons - only union-related categories
const categoryIcons: Record<string, React.ReactNode> = {
  'Sindical - Geral': <Building2 className="h-5 w-5 text-purple-500" />,
  'Sindical - Empresas': <Building className="h-5 w-5 text-amber-500" />,
  'Sindical - Sócios': <Users className="h-5 w-5 text-purple-500" />,
  'Sindical - Contribuições': <CreditCard className="h-5 w-5 text-emerald-500" />,
  'Sindical - Financeiro': <CreditCard className="h-5 w-5 text-blue-500" />,
  'Sindical - Negociações': <FileText className="h-5 w-5 text-purple-500" />,
  'Sindical - Auditoria': <Eye className="h-5 w-5 text-slate-500" />,
  'Sindical - Homologação': <Calendar className="h-5 w-5 text-teal-500" />,
  'Sindical - Jurídico': <ClipboardList className="h-5 w-5 text-indigo-500" />,
};

// Friendly category descriptions
const categoryDescriptions: Record<string, string> = {
  'Sindical - Geral': 'Acesso geral ao módulo sindical',
  'Sindical - Empresas': 'Cadastro e gestão de empresas associadas',
  'Sindical - Sócios': 'Gestão de sócios e associados',
  'Sindical - Contribuições': 'Gestão de contribuições e boletos sindicais',
  'Sindical - Financeiro': 'Controle financeiro do sindicato',
  'Sindical - Negociações': 'Negociação de débitos e acordos',
  'Sindical - Auditoria': 'Logs e auditoria do módulo sindical',
  'Sindical - Homologação': 'Agendamento e gestão de homologações',
  'Sindical - Jurídico': 'Gestão de processos jurídicos',
};

// Permission action icons
const getPermissionIcon = (key: string) => {
  if (key.startsWith('view_') || key.includes('visualizar') || key.includes('union_view')) return <Eye className="h-4 w-4 text-blue-500" />;
  if (key.startsWith('manage_') || key.startsWith('edit_') || key.includes('union_manage')) return <Edit className="h-4 w-4 text-amber-500" />;
  if (key.startsWith('delete_') || key.includes('union_delete')) return <Trash className="h-4 w-4 text-red-500" />;
  if (key.startsWith('send_') || key.includes('union_send')) return <Send className="h-4 w-4 text-green-500" />;
  if (key.includes('generate') || key.includes('union_generate')) return <FileText className="h-4 w-4 text-indigo-500" />;
  return <CheckCircle2 className="h-4 w-4 text-primary" />;
};

export default function UnionAccessGroupsPage() {
  const { currentClinic, isSuperAdmin } = useAuth();
  const { isAdmin } = usePermissions();
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<AccessGroup | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Only admins can access this page
  const canManage = isAdmin || isSuperAdmin;

  useEffect(() => {
    if (canManage) {
      fetchData();
    }
  }, [currentClinic?.id, canManage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, permissionsRes] = await Promise.all([
        supabase
          .from('access_groups')
          .select('*')
          .eq('module_type', 'union')
          .order('is_system', { ascending: false })
          .order('name'),
        supabase
          .from('permission_definitions')
          .select('*')
          .eq('is_active', true)
          .eq('module_type', 'union')
          .order('category')
          .order('order_index')
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (permissionsRes.error) throw permissionsRes.error;

      setGroups(groupsRes.data || []);
      setPermissions(permissionsRes.data || []);
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
    if (!categoryPermissions?.length) return;
    
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      categoryPermissions.forEach(p => {
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
        // Create new group (for union module)
        const { data, error } = await supabase
          .from('access_groups')
          .insert({
            name: groupName.trim(),
            description: groupDescription.trim() || null,
            module_type: 'union',
            clinic_id: currentClinic?.id || null,
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

  // Filter groups by search term
  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryPermissionStats = (category: string) => {
    const categoryPerms = groupedPermissions[category] || [];
    const selectedCount = categoryPerms.filter(p => selectedPermissions.has(p.key)).length;
    const allSelected = categoryPerms.length > 0 && selectedCount === categoryPerms.length;
    return { selected: selectedCount, total: categoryPerms.length, allSelected };
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

  // Access denied for non-admins
  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <ShieldCheck className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Apenas administradores podem acessar as configurações de grupos de acesso.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10">
            <Shield className="h-8 w-8 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Grupos de Acesso</h1>
            <p className="text-sm text-muted-foreground">
              Configure permissões de usuários do módulo sindical
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
              <div className="px-4 pb-3 space-y-2">
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
                        selectedGroup?.id === group.id ? 'bg-purple-500/10 border-l-2 border-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${selectedGroup?.id === group.id ? 'bg-purple-500/20' : 'bg-muted'}`}>
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
                        <div className="flex items-center gap-1 shrink-0">
                          {group.is_system && (
                            <Badge variant="secondary" className="text-xs">
                              Padrão
                            </Badge>
                          )}
                        </div>
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
                    placeholder="Ex: Secretária Sindical, Financeiro..."
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
                <Badge variant="outline" className="self-start sm:self-auto bg-purple-500/10 text-purple-600 border-purple-200">
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
              <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-200/50">
                <Info className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p><strong>Como funciona:</strong> Use o interruptor de cada categoria para ativar/desativar todas as permissões de uma vez, ou marque permissões individuais abaixo de cada categoria.</p>
                </div>
              </div>

              {/* Categories Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredCategories.map(([category, categoryPermissions]) => {
                  const stats = categoryPermissionStats(category);
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
                          const isSelected = selectedPermissions.has(perm.key);
                          
                          return (
                            <div 
                              key={perm.id} 
                              className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                                isSelected ? 'bg-purple-500/5' : 'hover:bg-muted/50'
                              }`}
                            >
                              <Checkbox
                                id={perm.key}
                                checked={isSelected}
                                onCheckedChange={() => handleTogglePermission(perm.key)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <Label
                                  htmlFor={perm.key}
                                  className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                                >
                                  {getPermissionIcon(perm.key)}
                                  <span className="truncate">{perm.name}</span>
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

              {filteredCategories.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma permissão encontrada para o módulo sindical.</p>
                  <p className="text-sm mt-1">As permissões serão exibidas aqui quando configuradas.</p>
                </div>
              )}
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
