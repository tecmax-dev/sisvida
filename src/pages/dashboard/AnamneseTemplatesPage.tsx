import { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  MoreVertical,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AnamneseTemplateBuilder,
  Question,
} from "@/components/anamnesis/AnamneseTemplateBuilder";
import {
  AnamneseResponseForm,
  Answer,
} from "@/components/anamnesis/AnamneseResponseForm";

interface Template {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  questions_count?: number;
}

export default function AnamneseTemplatesPage() {
  const { currentClinic, user } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);

  // Preview state
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [previewAnswers, setPreviewAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    if (currentClinic) {
      fetchTemplates();
    }
  }, [currentClinic]);

  const fetchTemplates = async () => {
    if (!currentClinic) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("anamnese_templates")
        .select(`
          id,
          title,
          description,
          is_active,
          created_at
        `)
        .eq("clinic_id", currentClinic.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch question counts
      const templatesWithCounts = await Promise.all(
        (data || []).map(async (template) => {
          const { count } = await supabase
            .from("anamnese_questions")
            .select("id", { count: "exact", head: true })
            .eq("template_id", template.id);

          return { ...template, questions_count: count || 0 };
        })
      );

      setTemplates(templatesWithCounts);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Erro ao carregar templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateQuestions = async (templateId: string) => {
    const { data: questionsData, error: questionsError } = await supabase
      .from("anamnese_questions")
      .select("*")
      .eq("template_id", templateId)
      .order("order_index");

    if (questionsError) throw questionsError;

    const questionsWithOptions = await Promise.all(
      (questionsData || []).map(async (q) => {
        const { data: optionsData } = await supabase
          .from("anamnese_question_options")
          .select("*")
          .eq("question_id", q.id)
          .order("order_index");

        return {
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type as Question["question_type"],
          is_required: q.is_required,
          order_index: q.order_index,
          options: (optionsData || []).map((o) => ({
            id: o.id,
            option_text: o.option_text,
            order_index: o.order_index,
          })),
        };
      })
    );

    return questionsWithOptions;
  };

  const handleOpenCreate = () => {
    setFormTitle("");
    setFormDescription("");
    setFormIsActive(true);
    setQuestions([]);
    setCreateDialogOpen(true);
  };

  const handleOpenEdit = async (template: Template) => {
    setSelectedTemplate(template);
    setFormTitle(template.title);
    setFormDescription(template.description || "");
    setFormIsActive(template.is_active);

    try {
      const questionsWithOptions = await fetchTemplateQuestions(template.id);
      setQuestions(questionsWithOptions);
      setEditDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar perguntas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenPreview = async (template: Template) => {
    setSelectedTemplate(template);

    try {
      const questionsWithOptions = await fetchTemplateQuestions(template.id);
      setPreviewQuestions(questionsWithOptions);
      setPreviewAnswers([]);
      setPreviewDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar perguntas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenDelete = (template: Template) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleDuplicate = async (template: Template) => {
    if (!currentClinic) return;

    try {
      // Create new template
      const { data: newTemplate, error: templateError } = await supabase
        .from("anamnese_templates")
        .insert({
          clinic_id: currentClinic.id,
          title: `${template.title} (cópia)`,
          description: template.description,
          is_active: false,
          created_by: user?.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Copy questions
      const questionsWithOptions = await fetchTemplateQuestions(template.id);

      for (const question of questionsWithOptions) {
        const { data: newQuestion, error: questionError } = await supabase
          .from("anamnese_questions")
          .insert({
            template_id: newTemplate.id,
            question_text: question.question_text,
            question_type: question.question_type,
            is_required: question.is_required,
            order_index: question.order_index,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // Copy options
        if (question.options.length > 0) {
          const { error: optionsError } = await supabase
            .from("anamnese_question_options")
            .insert(
              question.options.map((o) => ({
                question_id: newQuestion.id,
                option_text: o.option_text,
                order_index: o.order_index,
              }))
            );

          if (optionsError) throw optionsError;
        }
      }

      toast({ title: "Template duplicado com sucesso!" });
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao duplicar template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveTemplate = async (isEdit: boolean) => {
    if (!currentClinic || !formTitle.trim()) {
      toast({
        title: "Título obrigatório",
        description: "Informe um título para o template",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      let templateId: string;

      if (isEdit && selectedTemplate) {
        // Update template
        const { error: updateError } = await supabase
          .from("anamnese_templates")
          .update({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            is_active: formIsActive,
          })
          .eq("id", selectedTemplate.id);

        if (updateError) throw updateError;
        templateId = selectedTemplate.id;

        // Delete existing questions (cascade deletes options)
        await supabase
          .from("anamnese_questions")
          .delete()
          .eq("template_id", templateId);
      } else {
        // Create new template
        const { data: newTemplate, error: createError } = await supabase
          .from("anamnese_templates")
          .insert({
            clinic_id: currentClinic.id,
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            is_active: formIsActive,
            created_by: user?.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        templateId = newTemplate.id;
      }

      // Insert questions
      for (const question of questions) {
        if (!question.question_text.trim()) continue;

        const { data: newQuestion, error: questionError } = await supabase
          .from("anamnese_questions")
          .insert({
            template_id: templateId,
            question_text: question.question_text.trim(),
            question_type: question.question_type,
            is_required: question.is_required,
            order_index: question.order_index,
          })
          .select()
          .single();

        if (questionError) throw questionError;

        // Insert options
        const validOptions = question.options.filter((o) => o.option_text.trim());
        if (validOptions.length > 0) {
          const { error: optionsError } = await supabase
            .from("anamnese_question_options")
            .insert(
              validOptions.map((o) => ({
                question_id: newQuestion.id,
                option_text: o.option_text.trim(),
                order_index: o.order_index,
              }))
            );

          if (optionsError) throw optionsError;
        }
      }

      toast({ title: `Template ${isEdit ? "atualizado" : "criado"} com sucesso!` });
      setCreateDialogOpen(false);
      setEditDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const { error } = await supabase
        .from("anamnese_templates")
        .delete()
        .eq("id", selectedTemplate.id);

      if (error) throw error;

      toast({ title: "Template excluído com sucesso!" });
      setDeleteDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderTemplateForm = (isEdit: boolean) => (
    <Tabs defaultValue="info" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="info">Informações</TabsTrigger>
        <TabsTrigger value="questions">Perguntas ({questions.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="info" className="space-y-4">
        <div>
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Ex: Anamnese Geral"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Descreva o objetivo deste formulário..."
            className="mt-1.5"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label htmlFor="is_active">Ativo</Label>
            <p className="text-sm text-muted-foreground">
              Templates inativos não aparecem na seleção
            </p>
          </div>
          <Switch
            id="is_active"
            checked={formIsActive}
            onCheckedChange={setFormIsActive}
          />
        </div>
      </TabsContent>

      <TabsContent value="questions">
        <AnamneseTemplateBuilder
          questions={questions}
          onQuestionsChange={setQuestions}
        />
      </TabsContent>
    </Tabs>
  );

  const canView = hasPermission("view_anamnesis_templates") || hasPermission("manage_anamnesis_templates");
  const canEdit = hasPermission("edit_anamnesis_templates") || hasPermission("manage_anamnesis_templates");
  const canDelete = hasPermission("delete_anamnesis_templates") || hasPermission("manage_anamnesis_templates");
  const canSendWhatsApp = hasPermission("send_anamnesis_whatsapp") || hasPermission("manage_anamnesis_templates");
  const canCreate = hasPermission("manage_anamnesis_templates");

  return (
    <RoleGuard permission="view_anamnesis_templates">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates de Anamnese</h1>
          <p className="text-muted-foreground">
            Crie e gerencie formulários personalizados
          </p>
        </div>
        {canCreate && (
          <Button variant="hero" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery ? "Nenhum template encontrado" : "Nenhum template criado"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "Tente uma busca diferente"
                : "Crie seu primeiro template de anamnese"}
            </p>
            {!searchQuery && (
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{template.title}</CardTitle>
                    {template.description && (
                      <CardDescription className="line-clamp-2 mt-1">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenPreview(template)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Pré-visualizar
                      </DropdownMenuItem>
                      {canEdit && (
                        <DropdownMenuItem onClick={() => handleOpenEdit(template)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {canCreate && (
                        <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          onClick={() => handleOpenDelete(template)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {template.questions_count || 0} perguntas
                  </Badge>
                  <Badge variant={template.is_active ? "default" : "outline"}>
                    {template.is_active ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ativo
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Inativo
                      </>
                    )}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Template de Anamnese</DialogTitle>
            <DialogDescription>
              Crie um formulário personalizado para coleta de informações
            </DialogDescription>
          </DialogHeader>

          {renderTemplateForm(false)}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleSaveTemplate(false)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              Modifique as informações e perguntas do formulário
            </DialogDescription>
          </DialogHeader>

          {renderTemplateForm(true)}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleSaveTemplate(true)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização: {selectedTemplate?.title}</DialogTitle>
            <DialogDescription>
              Veja como o formulário será exibido para o paciente
            </DialogDescription>
          </DialogHeader>

          <AnamneseResponseForm
            questions={previewQuestions}
            answers={previewAnswers}
            onAnswersChange={setPreviewAnswers}
          />

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setPreviewDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template "{selectedTemplate?.title}" e todas as suas perguntas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RoleGuard>
  );
}
