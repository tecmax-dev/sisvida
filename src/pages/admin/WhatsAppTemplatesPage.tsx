import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, FileCode, CheckCircle2, AlertCircle } from "lucide-react";

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  status: string;
  language: string;
}

export default function WhatsAppTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "utility",
    content: "",
    language: "pt_BR",
    status: "approved"
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      console.error("Error fetching templates:", err);
      toast({
        title: "Erro ao carregar templates",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update(formData)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast({ title: "Template atualizado" });
      } else {
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert([formData]);
        if (error) throw error;
        toast({ title: "Template criado" });
      }
      setIsDialogOpen(false);
      setEditingTemplate(null);
      setFormData({ name: "", category: "utility", content: "", language: "pt_BR", status: "approved" });
      fetchTemplates();
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Template excluído" });
      fetchTemplates();
    } catch (err: any) {
      toast({
        title: "Erro ao excluir",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      content: template.content,
      language: template.language,
      status: template.status
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates WhatsApp</h1>
          <p className="text-muted-foreground">Gerencie os modelos aprovados pela Meta para reativar conversas.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => {
              setEditingTemplate(null);
              setFormData({ name: "", category: "utility", content: "", language: "pt_BR", status: "approved" });
            }}>
              <Plus className="h-4 w-4" /> Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
                <DialogDescription>
                  O nome deve ser exatamente igual ao aprovado no painel da Meta.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome (snake_case)</label>
                  <Input 
                    placeholder="ex: reativacao_atendimento" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Conteúdo</label>
                  <Textarea 
                    placeholder="Conteúdo do modelo..." 
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    required
                    className="min-h-[100px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoria</label>
                    <Input 
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Idioma</label>
                    <Input 
                      value={formData.language}
                      onChange={e => setFormData({...formData, language: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar Template</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            Modelos Registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-mono text-xs font-bold">{template.name}</TableCell>
                    <TableCell><Badge variant="outline">{template.category}</Badge></TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">{template.content}</TableCell>
                    <TableCell>
                      <Badge className="gap-1 bg-green-500/10 text-green-500 hover:bg-green-500/20">
                        <CheckCircle2 className="h-3 w-3" /> {template.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(template.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum template cadastrado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 flex gap-3 rounded-r-lg">
        <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-blue-900">Aviso sobre Templates:</p>
          <p className="text-xs text-blue-800">Estes modelos devem ser primeiro criados e aprovados no Painel do Desenvolvedor da Meta (Meta for Developers). O sistema apenas espelha esses nomes para permitir o envio via API quando a janela de 24h estiver fechada.</p>
        </div>
      </div>
    </div>
  );
}