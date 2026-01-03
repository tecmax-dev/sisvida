import { useState } from 'react';
import { useWhatsAppQuickReplies, useWhatsAppSectors } from '@/hooks/useWhatsAppMultiattendance';
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
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Zap, Trash2 } from 'lucide-react';
import { WhatsAppQuickReply } from '@/types/whatsapp-multiattendance';

interface QuickRepliesPanelProps {
  clinicId: string | undefined;
}

const fromTable = (table: string) => supabase.from(table as any);

export function QuickRepliesPanel({ clinicId }: QuickRepliesPanelProps) {
  const { quickReplies, isLoading, refetch } = useWhatsAppQuickReplies(clinicId);
  const { sectors } = useWhatsAppSectors(clinicId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<WhatsAppQuickReply | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    shortcut: '',
    category: '',
    sector_id: '',
  });

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      shortcut: '',
      category: '',
      sector_id: '',
    });
    setEditingReply(null);
  };

  const openEditDialog = (reply: WhatsAppQuickReply) => {
    setEditingReply(reply);
    setFormData({
      title: reply.title,
      content: reply.content,
      shortcut: reply.shortcut || '',
      category: reply.category || '',
      sector_id: reply.sector_id || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!clinicId || !formData.title || !formData.content) return;

    setIsSaving(true);
    try {
      const data = {
        title: formData.title,
        content: formData.content,
        shortcut: formData.shortcut || null,
        category: formData.category || null,
        sector_id: formData.sector_id || null,
      };

      if (editingReply) {
        const { error } = await fromTable('whatsapp_quick_replies')
          .update(data)
          .eq('id', editingReply.id);

        if (error) throw error;
        toast.success('Resposta atualizada');
      } else {
        const { error } = await fromTable('whatsapp_quick_replies')
          .insert({
            ...data,
            clinic_id: clinicId,
          });

        if (error) throw error;
        toast.success('Resposta criada');
      }

      setDialogOpen(false);
      resetForm();
      refetch();
    } catch (error) {
      console.error('Error saving quick reply:', error);
      toast.error('Erro ao salvar resposta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (reply: WhatsAppQuickReply) => {
    try {
      const { error } = await fromTable('whatsapp_quick_replies')
        .update({ is_active: !reply.is_active })
        .eq('id', reply.id);

      if (error) throw error;
      toast.success(reply.is_active ? 'Resposta desativada' : 'Resposta ativada');
      refetch();
    } catch (error) {
      toast.error('Erro ao atualizar resposta');
    }
  };

  const handleDelete = async (reply: WhatsAppQuickReply) => {
    if (!confirm('Deseja realmente excluir esta resposta rápida?')) return;

    try {
      const { error } = await fromTable('whatsapp_quick_replies')
        .delete()
        .eq('id', reply.id);

      if (error) throw error;
      toast.success('Resposta excluída');
      refetch();
    } catch (error) {
      toast.error('Erro ao excluir resposta');
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
            <CardTitle>Respostas Rápidas</CardTitle>
            <CardDescription>
              Crie mensagens prontas para agilizar os atendimentos. Use variáveis como {'{{nome}}'}, {'{{telefone}}'}, {'{{protocolo}}'}.
            </CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Resposta
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Atalho</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quickReplies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma resposta rápida cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                quickReplies.map((reply) => (
                  <TableRow key={reply.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{reply.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {reply.content}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {reply.shortcut ? (
                        <Badge variant="outline" className="font-mono">
                          /{reply.shortcut}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {reply.sector ? (
                        <Badge 
                          variant="secondary"
                          style={{ backgroundColor: `${reply.sector.color}20`, color: reply.sector.color }}
                        >
                          {reply.sector.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Todos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{reply.usage_count}</span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={reply.is_active}
                        onCheckedChange={() => handleToggleActive(reply)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(reply)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(reply)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingReply ? 'Editar Resposta Rápida' : 'Nova Resposta Rápida'}
            </DialogTitle>
            <DialogDescription>
              Crie uma mensagem pronta para usar durante os atendimentos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Saudação inicial"
              />
            </div>

            <div className="space-y-2">
              <Label>Conteúdo *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Olá {{nome}}! Como posso ajudar?"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{protocolo}}'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Atalho</Label>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-1">/</span>
                  <Input
                    value={formData.shortcut}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      shortcut: e.target.value.replace(/\s/g, '').toLowerCase()
                    }))}
                    placeholder="ola"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Ex: Saudações"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Setor (opcional)</Label>
              <Select
                value={formData.sector_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, sector_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os setores</SelectItem>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !formData.title || !formData.content}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingReply ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
