import { useState } from 'react';
import { useWhatsAppSectors } from '@/hooks/useWhatsAppMultiattendance';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, GripVertical } from 'lucide-react';
import { WhatsAppSector } from '@/types/whatsapp-multiattendance';

interface SectorsPanelProps {
  clinicId: string | undefined;
}

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', 
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const fromTable = (table: string) => supabase.from(table as any);

export function SectorsPanel({ clinicId }: SectorsPanelProps) {
  const { sectors, isLoading, refetch } = useWhatsAppSectors(clinicId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<WhatsAppSector | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
    });
    setEditingSector(null);
  };

  const openEditDialog = (sector: WhatsAppSector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name,
      description: sector.description || '',
      color: sector.color,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!clinicId || !formData.name) return;

    setIsSaving(true);
    try {
      if (editingSector) {
        const { error } = await fromTable('whatsapp_sectors')
          .update({
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
          })
          .eq('id', editingSector.id);

        if (error) throw error;
        toast.success('Setor atualizado');
      } else {
        const { error } = await fromTable('whatsapp_sectors')
          .insert({
            clinic_id: clinicId,
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            order_index: sectors.length,
          });

        if (error) throw error;
        toast.success('Setor criado');
      }

      setDialogOpen(false);
      resetForm();
      refetch();
    } catch (error) {
      console.error('Error saving sector:', error);
      toast.error('Erro ao salvar setor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (sector: WhatsAppSector) => {
    try {
      const { error } = await fromTable('whatsapp_sectors')
        .update({ is_active: !sector.is_active })
        .eq('id', sector.id);

      if (error) throw error;
      toast.success(sector.is_active ? 'Setor desativado' : 'Setor ativado');
      refetch();
    } catch (error) {
      toast.error('Erro ao atualizar setor');
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
            <CardTitle>Setores</CardTitle>
            <CardDescription>
              Configure os departamentos para organizar os atendimentos
            </CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Setor
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum setor cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                sectors.map((sector) => (
                  <TableRow key={sector.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: sector.color }}
                        />
                        <span className="font-medium">{sector.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sector.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={sector.is_active}
                        onCheckedChange={() => handleToggleActive(sector)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(sector)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSector ? 'Editar Setor' : 'Novo Setor'}
            </DialogTitle>
            <DialogDescription>
              {editingSector 
                ? 'Atualize as informações do setor'
                : 'Crie um novo setor para organizar os atendimentos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Recepção, Financeiro, Suporte..."
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição do setor..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color 
                        ? 'border-foreground scale-110' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSector ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
