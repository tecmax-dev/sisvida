import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import {
  useUnionAppContent,
  useCreateUnionAppContent,
  useUpdateUnionAppContent,
  useDeleteUnionAppContent,
  useUploadContentFile,
  CONTENT_TYPE_LABELS,
  ContentType,
  UnionAppContent,
} from "@/hooks/useUnionAppContent";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image,
  Handshake,
  FileText,
  FileCheck,
  Users,
  File,
  ExternalLink,
  Smartphone,
  AlertTriangle,
  MessageCircle,
  Bell,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OuvidoriaMessagesTab } from "@/components/union/OuvidoriaMessagesTab";
import { PushNotificationsTab } from "@/components/union/PushNotificationsTab";
import { ConveniosManagementTab } from "@/components/union/ConveniosManagementTab";
import { MobileAppTabsManagement } from "@/components/union/MobileAppTabsManagement";

const contentTypeIcons: Record<ContentType, React.ReactNode> = {
  banner: <Image className="h-4 w-4" />,
  convenio: <Handshake className="h-4 w-4" />,
  convencao: <FileText className="h-4 w-4" />,
  declaracao: <FileCheck className="h-4 w-4" />,
  diretoria: <Users className="h-4 w-4" />,
  documento: <File className="h-4 w-4" />,
};

interface FormData {
  content_type: ContentType;
  title: string;
  description: string;
  image_url: string;
  file_url: string;
  external_link: string;
  order_index: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

const defaultFormData: FormData = {
  content_type: "banner",
  title: "",
  description: "",
  image_url: "",
  file_url: "",
  external_link: "",
  order_index: 0,
  is_active: true,
  metadata: {},
};

type TabType = ContentType | "ouvidoria" | "push" | "tabs";

export default function UnionAppContentPage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { hasUnionPermission } = useUnionPermissions();
  
  const [activeTab, setActiveTab] = useState<TabType>("banner");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<UnionAppContent | null>(null);
  const [deletingContentId, setDeletingContentId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isUploading, setIsUploading] = useState(false);

  const { data: allContent, isLoading } = useUnionAppContent();
  const createContent = useCreateUnionAppContent();
  const updateContent = useUpdateUnionAppContent();
  const deleteContent = useDeleteUnionAppContent();
  const uploadFile = useUploadContentFile();

  // Check if user has admin access
  const hasAdminAccess = isSuperAdmin || hasUnionPermission("union_module_access");

  if (!hasAdminAccess) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Acesso Negado
            </CardTitle>
            <CardDescription>
              Você não possui permissão para acessar esta área. Apenas administradores podem gerenciar o conteúdo do aplicativo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const filteredContent = activeTab !== "ouvidoria" 
    ? allContent?.filter(c => c.content_type === activeTab) || []
    : [];

  const handleOpenCreate = () => {
    if (activeTab === "ouvidoria") return; // Can't create ouvidoria messages from admin
    setEditingContent(null);
    setFormData({
      ...defaultFormData,
      content_type: activeTab as ContentType,
      order_index: filteredContent.length,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (content: UnionAppContent) => {
    setEditingContent(content);
    setFormData({
      content_type: content.content_type,
      title: content.title,
      description: content.description || "",
      image_url: content.image_url || "",
      file_url: content.file_url || "",
      external_link: content.external_link || "",
      order_index: content.order_index,
      is_active: content.is_active,
      metadata: (content.metadata as Record<string, unknown>) || {},
    });
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadFile.mutateAsync({ file, folder: "images" });
      setFormData(prev => ({ ...prev, image_url: url }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadFile.mutateAsync({ file, folder: "files" });
      setFormData(prev => ({ ...prev, file_url: url }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;

    if (editingContent) {
      await updateContent.mutateAsync({
        id: editingContent.id,
        ...formData,
      });
    } else {
      await createContent.mutateAsync(formData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingContentId) return;
    await deleteContent.mutateAsync(deletingContentId);
    setIsDeleteDialogOpen(false);
    setDeletingContentId(null);
  };

  const handleToggleActive = async (content: UnionAppContent) => {
    await updateContent.mutateAsync({
      id: content.id,
      is_active: !content.is_active,
    });
  };

  const handleMoveUp = async (content: UnionAppContent, index: number) => {
    if (index === 0) return;
    const prevContent = filteredContent[index - 1];
    await updateContent.mutateAsync({ id: content.id, order_index: prevContent.order_index });
    await updateContent.mutateAsync({ id: prevContent.id, order_index: content.order_index });
  };

  const handleMoveDown = async (content: UnionAppContent, index: number) => {
    if (index === filteredContent.length - 1) return;
    const nextContent = filteredContent[index + 1];
    await updateContent.mutateAsync({ id: content.id, order_index: nextContent.order_index });
    await updateContent.mutateAsync({ id: nextContent.id, order_index: content.order_index });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />
            Gestão de Conteúdo do App
          </h1>
          <p className="text-muted-foreground">
          Gerencie banners, convênios, convenções, declarações, diretoria, documentos e interações da ouvidoria
          </p>
        </div>
      {activeTab !== "ouvidoria" && activeTab !== "push" && (
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo {CONTENT_TYPE_LABELS[activeTab as ContentType].slice(0, -1)}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-9 h-auto">
          {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => (
            <TabsTrigger
              key={type}
              value={type}
              className="flex items-center gap-2 py-2"
            >
              {contentTypeIcons[type]}
              <span className="hidden sm:inline">{CONTENT_TYPE_LABELS[type]}</span>
              <Badge variant="secondary" className="ml-1">
                {allContent?.filter(c => c.content_type === type).length || 0}
              </Badge>
            </TabsTrigger>
          ))}
          <TabsTrigger
            value="ouvidoria"
            className="flex items-center gap-2 py-2"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Ouvidoria</span>
          </TabsTrigger>
          <TabsTrigger
            value="push"
            className="flex items-center gap-2 py-2"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Push</span>
          </TabsTrigger>
          <TabsTrigger
            value="tabs"
            className="flex items-center gap-2 py-2"
          >
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Abas App</span>
          </TabsTrigger>
        </TabsList>

        {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => (
          <TabsContent key={type} value={type} className="mt-4">
            {type === "convenio" ? (
              <ConveniosManagementTab />
            ) : filteredContent.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    {contentTypeIcons[type]}
                  </div>
                  <h3 className="font-medium mb-1">Nenhum conteúdo encontrado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Adicione seu primeiro {CONTENT_TYPE_LABELS[type].toLowerCase().slice(0, -1)}
                  </p>
                  <Button onClick={handleOpenCreate} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredContent.map((content, index) => (
                  <Card key={content.id} className={!content.is_active ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {content.image_url && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <img
                              src={content.image_url}
                              alt={content.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-medium truncate">{content.title}</h3>
                              {content.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {content.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Badge variant={content.is_active ? "default" : "secondary"}>
                                {content.is_active ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {content.external_link && (
                              <a
                                href={content.external_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Link externo
                              </a>
                            )}
                            {content.file_url && (
                              <a
                                href={content.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <File className="h-3 w-3" />
                                Arquivo
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveUp(content, index)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveDown(content, index)}
                            disabled={index === filteredContent.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Switch
                            checked={content.is_active}
                            onCheckedChange={() => handleToggleActive(content)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(content)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingContentId(content.id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        {/* Ouvidoria Tab */}
        <TabsContent value="ouvidoria" className="mt-4">
          <OuvidoriaMessagesTab />
        </TabsContent>

        {/* Push Notifications Tab */}
        <TabsContent value="push" className="mt-4">
          <PushNotificationsTab />
        </TabsContent>

        {/* App Tabs Management */}
        <TabsContent value="tabs" className="mt-4">
          <MobileAppTabsManagement />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingContent ? "Editar" : "Novo"} {CONTENT_TYPE_LABELS[formData.content_type].slice(0, -1)}
            </DialogTitle>
            <DialogDescription>
              Preencha os campos para {editingContent ? "atualizar" : "criar"} o conteúdo
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Content Type */}
              {!editingContent && (
                <div className="space-y-2">
                  <Label>Tipo de Conteúdo</Label>
                  <Select
                    value={formData.content_type}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, content_type: v as ContentType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            {contentTypeIcons[type]}
                            {CONTENT_TYPE_LABELS[type]}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Digite o título"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Digite uma descrição"
                  rows={3}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Imagem</Label>
                <div className="flex items-center gap-4">
                  {formData.image_url && (
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ou cole uma URL de imagem abaixo
                    </p>
                    <Input
                      value={formData.image_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* File Upload - for documents, declarations, etc */}
              {(formData.content_type === 'documento' || formData.content_type === 'declaracao' || formData.content_type === 'convencao') && (
                <div className="space-y-2">
                  <Label>Arquivo (PDF, DOC, etc)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  {formData.file_url && (
                    <a
                      href={formData.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <File className="h-4 w-4" />
                      Ver arquivo atual
                    </a>
                  )}
                </div>
              )}

              {/* External Link */}
              <div className="space-y-2">
                <Label>Link Externo</Label>
                <Input
                  value={formData.external_link}
                  onChange={(e) => setFormData(prev => ({ ...prev, external_link: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <span className="text-sm">
                    {formData.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.title.trim() || createContent.isPending || updateContent.isPending || isUploading}
            >
              {(createContent.isPending || updateContent.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingContent ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este conteúdo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteContent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
