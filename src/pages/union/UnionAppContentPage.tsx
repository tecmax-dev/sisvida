import { useState, useEffect } from "react";
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
  Image,
  Handshake,
  FileText,
  FileCheck,
  Users,
  File,
  Smartphone,
  AlertTriangle,
  MessageCircle,
  Bell,
  Building2,
  Images,
  Newspaper,
  Radio,
  Video,
  HelpCircle,
  Headphones,
  Info,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OuvidoriaMessagesTab } from "@/components/union/OuvidoriaMessagesTab";
import { PushNotificationsTab } from "@/components/union/PushNotificationsTab";
import { ConveniosManagementTab } from "@/components/union/ConveniosManagementTab";
import { MobileAppTabsManagement } from "@/components/union/MobileAppTabsManagement";
import { CctCategoriesManagement } from "@/components/union/CctCategoriesManagement";
import { UnionContentList } from "@/components/union/UnionContentList";
import { AlbumManagementTab } from "@/components/union/AlbumManagementTab";
import { ImportUrlButton } from "@/components/union/ImportUrlButton";
import { HelpContentManagement } from "@/components/union/HelpContentManagement";
import { supabase } from "@/integrations/supabase/client";

interface EmployerCategory {
  id: string;
  name: string;
}

interface CctCategory {
  id: string;
  name: string;
  color: string;
}

const contentTypeIcons: Record<ContentType, React.ReactNode> = {
  banner: <Image className="h-4 w-4" />,
  convenio: <Handshake className="h-4 w-4" />,
  convencao: <FileText className="h-4 w-4" />,
  declaracao: <FileCheck className="h-4 w-4" />,
  diretoria: <Users className="h-4 w-4" />,
  documento: <File className="h-4 w-4" />,
  galeria: <Images className="h-4 w-4" />,
  jornal: <Newspaper className="h-4 w-4" />,
  radio: <Radio className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  faq: <HelpCircle className="h-4 w-4" />,
  atendimento: <Headphones className="h-4 w-4" />,
  sobre: <Info className="h-4 w-4" />,
  ajuda: <HelpCircle className="h-4 w-4" />,
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
  is_pinned: boolean;
  metadata: Record<string, unknown>;
  cct_category_id: string | null;
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
  is_pinned: false,
  metadata: {},
  cct_category_id: null,
};

type TabType = ContentType | "ouvidoria" | "push" | "tabs" | "cct-categories";

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
  const [categories, setCategories] = useState<EmployerCategory[]>([]);
  const [cctCategories, setCctCategories] = useState<CctCategory[]>([]);

  const { data: allContent, isLoading } = useUnionAppContent();
  const createContent = useCreateUnionAppContent();
  const updateContent = useUpdateUnionAppContent();
  const deleteContent = useDeleteUnionAppContent();
  const uploadFile = useUploadContentFile();
  const { currentClinic } = useAuth();

  // Load employer categories for portal CCT filtering
  useEffect(() => {
    const loadCategories = async () => {
      if (!currentClinic?.id) return;
      const { data } = await supabase
        .from("employer_categories")
        .select("id, name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      if (data) setCategories(data);
    };
    loadCategories();
  }, [currentClinic?.id]);

  // Load CCT categories for app tab organization
  useEffect(() => {
    const loadCctCategories = async () => {
      if (!currentClinic?.id) return;
      const { data } = await supabase
        .from("union_cct_categories")
        .select("id, name, color")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("order_index");
      if (data) setCctCategories(data);
    };
    loadCctCategories();
  }, [currentClinic?.id]);

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

  const isContentTab = (tab: TabType): tab is ContentType =>
    Object.prototype.hasOwnProperty.call(CONTENT_TYPE_LABELS, tab);

  const filteredContent = isContentTab(activeTab)
    ? allContent?.filter((c) => c.content_type === activeTab) || []
    : [];

  const handleOpenCreate = () => {
    if (!isContentTab(activeTab)) return;
    setEditingContent(null);
    setFormData({
      ...defaultFormData,
      content_type: activeTab,
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
      is_pinned: content.is_pinned || false,
      metadata: (content.metadata as Record<string, unknown>) || {},
      cct_category_id: content.cct_category_id || null,
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

  const handleTogglePinned = async (content: UnionAppContent) => {
    await updateContent.mutateAsync({
      id: content.id,
      is_pinned: !content.is_pinned,
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

  const renderContent = () => {
    if (activeTab === "cct-categories") {
      return <CctCategoriesManagement />;
    }
    if (activeTab === "ouvidoria") {
      return <OuvidoriaMessagesTab />;
    }
    if (activeTab === "push") {
      return <PushNotificationsTab />;
    }
    if (activeTab === "tabs") {
      return <MobileAppTabsManagement />;
    }
    if (isContentTab(activeTab)) {
      if (activeTab === "convenio") {
        return <ConveniosManagementTab />;
      }
      if (activeTab === "galeria") {
        return <AlbumManagementTab />;
      }
      if (activeTab === "ajuda") {
        return <HelpContentManagement />;
      }
      return (
        <UnionContentList
          content={filteredContent}
          contentType={activeTab}
          onOpenCreate={handleOpenCreate}
          onOpenEdit={handleOpenEdit}
          onDelete={(id) => {
            setDeletingContentId(id);
            setIsDeleteDialogOpen(true);
          }}
          onToggleActive={handleToggleActive}
          onTogglePinned={handleTogglePinned}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          cctCategories={cctCategories}
        />
      );
    }
    return null;
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 flex-shrink-0 overflow-y-auto">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Conteúdo do App
          </h1>
        </div>
        
        <nav className="p-2 space-y-1">
          {/* Content Types */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Conteúdo
          </div>
          {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                activeTab === type
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {contentTypeIcons[type]}
              <span className="flex-1 text-left truncate">{CONTENT_TYPE_LABELS[type]}</span>
              <Badge 
                variant={activeTab === type ? "secondary" : "outline"} 
                className={`ml-auto h-5 min-w-5 px-1.5 text-xs ${
                  activeTab === type ? "bg-primary-foreground/20 text-primary-foreground" : ""
                }`}
              >
                {allContent?.filter(c => c.content_type === type).length || 0}
              </Badge>
            </button>
          ))}
          
          {/* Separator */}
          <div className="my-3 border-t" />
          
          {/* System Tabs */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Sistema
          </div>
          <button
            onClick={() => setActiveTab("ouvidoria")}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === "ouvidoria"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="flex-1 text-left">Ouvidoria</span>
          </button>
          <button
            onClick={() => setActiveTab("push")}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === "push"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bell className="h-4 w-4" />
            <span className="flex-1 text-left">Push Notifications</span>
          </button>
          <button
            onClick={() => setActiveTab("tabs")}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === "tabs"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span className="flex-1 text-left">Abas do App</span>
          </button>
          <button
            onClick={() => setActiveTab("cct-categories")}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === "cct-categories"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span className="flex-1 text-left">Categorias CCT</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {isContentTab(activeTab) 
                  ? CONTENT_TYPE_LABELS[activeTab]
                  : activeTab === "ouvidoria" 
                    ? "Ouvidoria" 
                    : activeTab === "push" 
                      ? "Push Notifications"
                      : activeTab === "tabs"
                        ? "Abas do App"
                        : "Categorias CCT"
                }
              </h2>
              <p className="text-muted-foreground">
                {isContentTab(activeTab) 
                  ? `Gerencie os ${CONTENT_TYPE_LABELS[activeTab].toLowerCase()} do aplicativo`
                  : activeTab === "ouvidoria" 
                    ? "Visualize e responda mensagens da ouvidoria" 
                    : activeTab === "push" 
                      ? "Envie notificações push para os usuários"
                      : activeTab === "tabs"
                        ? "Configure as abas visíveis no aplicativo"
                        : "Organize as categorias de CCT"
                }
              </p>
            </div>
            {isContentTab(activeTab) && activeTab !== "convenio" && activeTab !== "galeria" && activeTab !== "ajuda" && (
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo {CONTENT_TYPE_LABELS[activeTab].slice(0, -1)}
              </Button>
            )}
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </main>

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
              {/* Import from URL - only for jornal type */}
              {formData.content_type === "jornal" && !editingContent && (
                <ImportUrlButton
                  onImport={(data) => {
                    setFormData((prev) => ({
                      ...prev,
                      title: data.title || prev.title,
                      description: data.description || prev.description,
                      image_url: data.image_url || prev.image_url,
                      external_link: data.external_link || prev.external_link,
                    }));
                  }}
                />
              )}

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

              {/* CCT Category Selection for App Tabs - for CCT only */}
              {formData.content_type === 'convencao' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Aba no App (Categoria CCT)
                  </Label>
                  <Select
                    value={formData.cct_category_id || "none"}
                    onValueChange={(v) => setFormData(prev => ({ 
                      ...prev, 
                      cct_category_id: v === "none" ? null : v
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a aba..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria (todas as abas)</SelectItem>
                      {cctCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Organiza as CCTs em abas no aplicativo mobile.
                  </p>
                  {cctCategories.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Nenhuma categoria CCT cadastrada. Adicione em "Categorias CCT".
                    </p>
                  )}
                </div>
              )}

              {/* Portal Category Selection - for CCT only */}
              {formData.content_type === 'convencao' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Categoria de Empresas (Portal)
                  </Label>
                  <Select
                    value={(formData.metadata.target_category_id as string) || "all"}
                    onValueChange={(v) => setFormData(prev => ({ 
                      ...prev, 
                      metadata: { ...prev.metadata, target_category_id: v === "all" ? undefined : v }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Apenas empresas da categoria selecionada verão esta CCT no portal.
                  </p>
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
