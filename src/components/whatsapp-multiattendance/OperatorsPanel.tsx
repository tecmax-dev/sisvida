import { useEffect, useMemo, useState } from 'react';
import { useWhatsAppOperators, useWhatsAppSectors } from '@/hooks/useWhatsAppMultiattendance';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Plus, 
  Loader2, 
  Pencil, 
  UserPlus,
  Circle
} from 'lucide-react';
import {
  OPERATOR_STATUS_LABELS,
  OPERATOR_STATUS_COLORS,
  OPERATOR_ROLE_LABELS,
  WhatsAppOperator,
  WhatsAppOperatorRole,
} from '@/types/whatsapp-multiattendance';

interface OperatorsPanelProps {
  clinicId: string | undefined;
}

const fromTable = (table: string) => supabase.from(table as any);

export function OperatorsPanel({ clinicId }: OperatorsPanelProps) {
  const { user, currentClinic } = useAuth();
  const { operators, isLoading, refetch } = useWhatsAppOperators(clinicId);
  const { sectors } = useWhatsAppSectors(clinicId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<WhatsAppOperator | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canManage = Boolean(clinicId && currentClinic?.id === clinicId);

  // Form state
  const [formData, setFormData] = useState({
    user_id: '',
    name: '',
    email: '',
    role: 'operator' as WhatsAppOperatorRole,
    max_simultaneous_tickets: 5,
    sector_ids: [] as string[],
  });

  // Auto-preencher com o usuário logado para facilitar "Assumir" tickets
  useEffect(() => {
    if (!dialogOpen || editingOperator) return;
    if (!user?.id) return;

    setFormData((prev) => ({
      ...prev,
      user_id: prev.user_id || user.id,
      email: prev.email || (user.email ?? ''),
      name: prev.name || (user.user_metadata?.name ?? ''),
    }));
  }, [dialogOpen, editingOperator, user?.id]);

  const resetForm = () => {
    setFormData({
      user_id: '',
      name: '',
      email: '',
      role: 'operator',
      max_simultaneous_tickets: 5,
      sector_ids: [],
    });
    setEditingOperator(null);
  };

  const openEditDialog = (operator: WhatsAppOperator) => {
    setEditingOperator(operator);
    setFormData({
      user_id: operator.user_id,
      name: operator.name,
      email: operator.email || '',
      role: operator.role,
      max_simultaneous_tickets: operator.max_simultaneous_tickets,
      sector_ids: operator.sectors?.map(s => s.id) || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!clinicId || !formData.name) return;

    setIsSaving(true);
    try {
      if (editingOperator) {
        // Update operator
        const { error } = await fromTable('whatsapp_operators')
          .update({
            name: formData.name,
            email: formData.email || null,
            role: formData.role,
            max_concurrent_tickets: formData.max_simultaneous_tickets,
          })
          .eq('id', editingOperator.id);

        if (error) throw error;

        // Update sectors
        await fromTable('whatsapp_operator_sectors')
          .delete()
          .eq('operator_id', editingOperator.id);

        if (formData.sector_ids.length > 0) {
          await fromTable('whatsapp_operator_sectors')
            .insert(formData.sector_ids.map(sector_id => ({
              operator_id: editingOperator.id,
              sector_id,
            })));
        }

        toast.success('Operador atualizado');
      } else {
        // Create operator
        const { data: newOp, error } = await fromTable('whatsapp_operators')
          .insert({
            clinic_id: clinicId,
            user_id: formData.user_id || user?.id || crypto.randomUUID(),
            name: formData.name,
            email: formData.email || null,
            role: formData.role,
            max_concurrent_tickets: formData.max_simultaneous_tickets,
          })
          .select()
          .single();

        if (error) throw error;

        // Add sectors
        if (formData.sector_ids.length > 0 && newOp) {
          await fromTable('whatsapp_operator_sectors')
            .insert(formData.sector_ids.map(sector_id => ({
              operator_id: (newOp as any).id,
              sector_id,
            })));
        }

        toast.success('Operador criado');
      }

      setDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error('Error saving operator:', error);
      toast.error(`Erro ao salvar operador: ${error?.message || error?.code || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (operator: WhatsAppOperator) => {
    try {
      const { error } = await fromTable('whatsapp_operators')
        .update({ is_active: !operator.is_active })
        .eq('id', operator.id);

      if (error) throw error;
      toast.success(operator.is_active ? 'Operador desativado' : 'Operador ativado');
      refetch();
    } catch (error) {
      toast.error('Erro ao atualizar operador');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Operadores</CardTitle>
            <CardDescription>
              Gerencie os operadores que podem atender via WhatsApp
            </CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Operador
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operador</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Setores</TableHead>
                <TableHead>Tickets</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum operador cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                operators.map((operator) => {
                  const initials = operator.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  
                  return (
                    <TableRow key={operator.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={operator.avatar_url || undefined} />
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{operator.name}</p>
                            <p className="text-xs text-muted-foreground">{operator.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {OPERATOR_ROLE_LABELS[operator.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Circle 
                            className="h-2.5 w-2.5 fill-current" 
                            style={{ color: OPERATOR_STATUS_COLORS[operator.status] }}
                          />
                          <span className="text-sm">
                            {OPERATOR_STATUS_LABELS[operator.status]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {operator.sectors?.slice(0, 2).map(sector => (
                            <Badge 
                              key={sector.id} 
                              variant="secondary"
                              className="text-xs"
                              style={{ backgroundColor: `${sector.color}20`, color: sector.color }}
                            >
                              {sector.name}
                            </Badge>
                          ))}
                          {(operator.sectors?.length || 0) > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(operator.sectors?.length || 0) - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {operator.current_ticket_count} / {operator.max_simultaneous_tickets}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={operator.is_active}
                          onCheckedChange={() => handleToggleActive(operator)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(operator)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOperator ? 'Editar Operador' : 'Novo Operador'}
            </DialogTitle>
            <DialogDescription>
              {editingOperator 
                ? 'Atualize as informações do operador'
                : 'Adicione um novo operador para atender via WhatsApp'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do operador"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Função</Label>
              <Select
                value={formData.role}
                onValueChange={(value: WhatsAppOperatorRole) => 
                  setFormData(prev => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Atendente</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Máximo de tickets simultâneos</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={formData.max_simultaneous_tickets}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  max_simultaneous_tickets: parseInt(e.target.value) || 5 
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Setores</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {sectors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum setor cadastrado
                  </p>
                ) : (
                  sectors.map((sector) => (
                    <div key={sector.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={sector.id}
                        checked={formData.sector_ids.includes(sector.id)}
                        onCheckedChange={(checked) => {
                          setFormData(prev => ({
                            ...prev,
                            sector_ids: checked
                              ? [...prev.sector_ids, sector.id]
                              : prev.sector_ids.filter(id => id !== sector.id),
                          }));
                        }}
                      />
                      <label
                        htmlFor={sector.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {sector.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingOperator ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
