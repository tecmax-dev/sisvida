import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, Zap, Link, Image, FileText, Loader2 } from "lucide-react";
import {
  useWhazingQuickResponses,
  useCreateQuickResponse,
  useUpdateQuickResponse,
  useDeleteQuickResponse,
  type WhazingQuickResponse,
} from "@/hooks/useWhazingQuickResponses";
import { toast } from "sonner";

const CATEGORIES = ["Saudação", "Informações", "Encerramento", "Suporte", "Financeiro", "Outro"];

export default function QuickResponsesManager() {
  const { data: responses, isLoading } = useWhazingQuickResponses();
  const createMut = useCreateQuickResponse();
  const updateMut = useUpdateQuickResponse();
  const deleteMut = useDeleteQuickResponse();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WhazingQuickResponse | null>(null);
  const [form, setForm] = useState({
    title: "",
    shortcut: "",
    body: "",
    media_url: "",
    media_type: "",
    category: "",
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", shortcut: "", body: "", media_url: "", media_type: "", category: "" });
    setDialogOpen(true);
  };

  const openEdit = (r: WhazingQuickResponse) => {
    setEditing(r);
    setForm({
      title: r.title,
      shortcut: r.shortcut || "",
      body: r.body,
      media_url: r.media_url || "",
      media_type: r.media_type || "",
      category: r.category || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Título e corpo são obrigatórios");
      return;
    }
    const payload = {
      title: form.title.trim(),
      shortcut: form.shortcut.trim() || null,
      body: form.body.trim(),
      media_url: form.media_url.trim() || null,
      media_type: form.media_type.trim() || null,
      category: form.category || null,
    };

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
        toast.success("Resposta atualizada");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Resposta criada");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta resposta rápida?")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Excluída");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Respostas Rápidas
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !responses?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma resposta rápida cadastrada
          </p>
        ) : (
          <div className="space-y-2">
            {responses.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{r.title}</span>
                    {r.shortcut && (
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        /{r.shortcut}
                      </Badge>
                    )}
                    {r.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {r.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{r.body}</p>
                  {r.media_url && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                      {r.media_type?.startsWith("image") ? (
                        <Image className="h-3 w-3" />
                      ) : r.media_url.startsWith("http") ? (
                        <Link className="h-3 w-3" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      <span className="truncate max-w-[200px]">{r.media_url}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Nova"} Resposta Rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Saudação inicial"
                />
              </div>
              <div>
                <Label>Atalho</Label>
                <Input
                  value={form.shortcut}
                  onChange={(e) => setForm({ ...form, shortcut: e.target.value.replace(/\s/g, "") })}
                  placeholder="saudacao"
                />
              </div>
            </div>
            <div>
              <Label>Corpo da mensagem *</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Olá! Como posso ajudá-lo?"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>URL de Mídia/Link</Label>
                <Input
                  value={form.media_url}
                  onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Tipo de Mídia</Label>
                <Select value={form.media_type} onValueChange={(v) => setForm({ ...form, media_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
