import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Save, 
  Trash2, 
  FileText,
  Loader2,
  Shield,
  ChevronDown,
  ChevronRight,
  Lock
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

interface GroupedAvailablePermissions {
  [category: string]: AvailablePermission[];
}

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

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
      
      // Expand all categories by default
      const categories = new Set((permissionsRes.data || []).map(p => p.category));
      setExpandedCategories(categories);
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

  const handleToggleCategory = (category: string) => {
    const categoryPermissions = groupedPermissions[category];
    // Only consider available permissions
    const availableCategoryPerms = categoryPermissions.filter(p => availablePermissions.has(p.key));
    if (availableCategoryPerms.length === 0) return;
    
    const allSelected = availableCategoryPerms.every(p => selectedPermissions.has(p.key));
    
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      availableCategoryPerms.forEach(p => {
        if (allSelected) {
          newSet.delete(p.key);
        } else {
          newSet.add(p.key);
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

  const toggleCategoryExpanded = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryPermissionCount = (category: string) => {
    const categoryPerms = groupedPermissions[category] || [];
    const availableCategoryPerms = categoryPerms.filter(p => availablePermissions.has(p.key));
    const selectedCount = availableCategoryPerms.filter(p => selectedPermissions.has(p.key)).length;
    const unavailableCount = categoryPerms.length - availableCategoryPerms.length;
    return { selected: selectedCount, total: availableCategoryPerms.length, unavailable: unavailableCount };
  };

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
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">GRUPO DE ACESSO</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie as permissões de acesso dos usuários
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={handleNewGroup} className="gap-2">
            <Plus className="h-4 w-4" />
            NOVO GRUPO DE ACESSO
          </Button>
        </div>
      </div>

      {/* Search and Count */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary" className="text-sm">
          TOTAL: {filteredGroups.length} grupo(s)
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Grupos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {filteredGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className={`w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors ${
                      selectedGroup?.id === group.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{group.name}</span>
                      {group.is_system && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          Sistema
                        </Badge>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {group.description}
                      </p>
                    )}
                  </button>
                ))}
                {filteredGroups.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum grupo encontrado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form and Permissions */}
        <div className="lg:col-span-3 space-y-4">
          {/* Group Form */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName">Nome do Grupo*</Label>
                  <Input
                    id="groupName"
                    placeholder="Digite o nome do grupo"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupDescription">Descrição</Label>
                  <Input
                    id="groupDescription"
                    placeholder="Descrição opcional"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissions Grid */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissões
                <Badge variant="secondary" className="ml-2">
                  {selectedPermissions.size} selecionadas
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => {
                  const { selected, total, unavailable } = categoryPermissionCount(category);
                  const allSelected = total > 0 && selected === total;
                  const someSelected = selected > 0 && selected < total;
                  const isExpanded = expandedCategories.has(category);
                  const hasUnavailable = unavailable > 0;

                  return (
                    <Card key={category} className="border shadow-sm">
                      <Collapsible open={isExpanded} onOpenChange={() => toggleCategoryExpanded(category)}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-accent/30 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={allSelected}
                                  onCheckedChange={() => handleToggleCategory(category)}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={total === 0}
                                  className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                                />
                                <CardTitle className="text-sm font-medium">{category}</CardTitle>
                                {hasUnavailable && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Lock className="h-3 w-3 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{unavailable} permissão(ões) requer upgrade do plano</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {selected}/{total}
                                </Badge>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Separator />
                          <CardContent className="py-3 px-4 space-y-2">
                            {categoryPermissions.map((perm) => {
                              const isAvailable = availablePermissions.has(perm.key);
                              return (
                                <div key={perm.id} className={`flex items-start gap-2 ${!isAvailable ? 'opacity-50' : ''}`}>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Checkbox
                                            id={perm.key}
                                            checked={selectedPermissions.has(perm.key)}
                                            onCheckedChange={() => handleTogglePermission(perm.key)}
                                            disabled={!isAvailable}
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
                                  <div className="grid gap-0.5 leading-none">
                                    <Label
                                      htmlFor={perm.key}
                                      className={`text-sm font-normal ${isAvailable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                    >
                                      {perm.name}
                                      {!isAvailable && (
                                        <Lock className="inline-block ml-1 h-3 w-3 text-muted-foreground" />
                                      )}
                                    </Label>
                                    {perm.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {perm.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            {selectedGroup && !selectedGroup.is_system && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                EXCLUIR
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleNewGroup}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              NOVO
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
              SALVAR
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
