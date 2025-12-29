import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { 
  useAllPanelBanners, 
  useCreatePanelBanner, 
  useUpdatePanelBanner, 
  useDeletePanelBanner, 
  useUploadPanelBannerImage,
  PanelBanner 
} from "@/hooks/usePanelBanners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Image, Loader2 } from "lucide-react";

interface BannerFormData {
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  button_text: string;
  button_link: string;
  background_color: string;
  text_color: string;
  overlay_opacity: number;
  duration_seconds: number;
  is_active: boolean;
}

const defaultFormData: BannerFormData = {
  title: "",
  subtitle: "",
  description: "",
  image_url: "",
  button_text: "",
  button_link: "",
  background_color: "#1e293b",
  text_color: "#ffffff",
  overlay_opacity: 0.4,
  duration_seconds: 5,
  is_active: true,
};

export default function PanelBannersPage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id || null;
  const navigate = useNavigate();
  const { data: banners, isLoading } = useAllPanelBanners(clinicId);
  const createBanner = useCreatePanelBanner();
  const updateBanner = useUpdatePanelBanner();
  const deleteBanner = useDeletePanelBanner();
  const uploadImage = useUploadPanelBannerImage();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BannerFormData>(defaultFormData);

  useEffect(() => {
    if (!clinicId) {
      navigate("/dashboard");
    }
  }, [clinicId, navigate]);

  const handleOpenCreate = () => {
    setFormData(defaultFormData);
    setEditingBannerId(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (banner: PanelBanner) => {
    setFormData({
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      description: banner.description || "",
      image_url: banner.image_url,
      button_text: banner.button_text || "",
      button_link: banner.button_link || "",
      background_color: banner.background_color || "#1e293b",
      text_color: banner.text_color || "#ffffff",
      overlay_opacity: banner.overlay_opacity || 0.4,
      duration_seconds: banner.duration_seconds || 5,
      is_active: banner.is_active,
    });
    setEditingBannerId(banner.id);
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadImage.mutateAsync(file);
      setFormData((prev) => ({ ...prev, image_url: url }));
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.image_url || !clinicId) return;

    const bannerData = {
      clinic_id: clinicId,
      title: formData.title || null,
      subtitle: formData.subtitle || null,
      description: formData.description || null,
      image_url: formData.image_url,
      button_text: formData.button_text || null,
      button_link: formData.button_link || null,
      background_color: formData.background_color || null,
      text_color: formData.text_color || null,
      overlay_opacity: formData.overlay_opacity,
      duration_seconds: formData.duration_seconds,
      is_active: formData.is_active,
      order_index: editingBannerId 
        ? (banners?.find(b => b.id === editingBannerId)?.order_index || 0) 
        : (banners?.length || 0),
    };

    if (editingBannerId) {
      await updateBanner.mutateAsync({ 
        id: editingBannerId, 
        clinic_id: clinicId,
        ...bannerData 
      });
    } else {
      await createBanner.mutateAsync(bannerData);
    }

    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingBannerId || !clinicId) return;
    await deleteBanner.mutateAsync({ id: deletingBannerId, clinic_id: clinicId });
    setIsDeleteDialogOpen(false);
    setDeletingBannerId(null);
  };

  const handleToggleActive = async (banner: PanelBanner) => {
    if (!clinicId) return;
    await updateBanner.mutateAsync({
      id: banner.id,
      clinic_id: clinicId,
      is_active: !banner.is_active,
    });
  };

  const handleMoveUp = async (banner: PanelBanner, index: number) => {
    if (index === 0 || !banners || !clinicId) return;
    const prevBanner = banners[index - 1];
    await Promise.all([
      updateBanner.mutateAsync({
        id: banner.id,
        clinic_id: clinicId,
        order_index: prevBanner.order_index,
      }),
      updateBanner.mutateAsync({
        id: prevBanner.id,
        clinic_id: clinicId,
        order_index: banner.order_index,
      }),
    ]);
  };

  const handleMoveDown = async (banner: PanelBanner, index: number) => {
    if (!banners || index === banners.length - 1 || !clinicId) return;
    const nextBanner = banners[index + 1];
    await Promise.all([
      updateBanner.mutateAsync({
        id: banner.id,
        clinic_id: clinicId,
        order_index: nextBanner.order_index,
      }),
      updateBanner.mutateAsync({
        id: nextBanner.id,
        clinic_id: clinicId,
        order_index: banner.order_index,
      }),
    ]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banners do Painel</h1>
          <p className="text-muted-foreground">
            Gerencie os banners exibidos no painel de chamadas quando não há chamadas ativas
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Banner
        </Button>
      </div>

      {banners?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum banner cadastrado. Crie banners para exibir no painel de chamadas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {banners?.map((banner, index) => (
            <Card key={banner.id} className={!banner.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div 
                    className="w-32 h-20 rounded bg-cover bg-center flex-shrink-0"
                    style={{ backgroundImage: `url(${banner.image_url})` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium truncate">{banner.title || "Sem título"}</h3>
                        {banner.subtitle && (
                          <p className="text-sm text-muted-foreground truncate">{banner.subtitle}</p>
                        )}
                        {banner.description && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{banner.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveUp(banner, index)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveDown(banner, index)}
                          disabled={index === (banners?.length || 0) - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={banner.is_active}
                          onCheckedChange={() => handleToggleActive(banner)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(banner)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingBannerId(banner.id);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Duração: {banner.duration_seconds || 5}s</span>
                      {banner.button_text && <span>Botão: {banner.button_text}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBannerId ? "Editar Banner" : "Novo Banner"}</DialogTitle>
            <DialogDescription>
              Configure o banner que será exibido no painel de chamadas
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Imagem de fundo *</Label>
              <div className="flex gap-4 items-start">
                {formData.image_url && (
                  <div 
                    className="w-32 h-20 rounded bg-cover bg-center flex-shrink-0"
                    style={{ backgroundImage: `url(${formData.image_url})` }}
                  />
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadImage.isPending}
                  />
                  {uploadImage.isPending && (
                    <p className="text-sm text-muted-foreground mt-1">Enviando...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título do banner"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subtitle">Subtítulo</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Subtítulo do banner"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição ou mensagem do banner"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="button_text">Texto do botão</Label>
                <Input
                  id="button_text"
                  value={formData.button_text}
                  onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                  placeholder="Ex: Saiba mais"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="button_link">Link do botão</Label>
                <Input
                  id="button_link"
                  value={formData.button_link}
                  onChange={(e) => setFormData({ ...formData, button_link: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="background_color">Cor de fundo</Label>
                <Input
                  id="background_color"
                  type="color"
                  value={formData.background_color}
                  onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="text_color">Cor do texto</Label>
                <Input
                  id="text_color"
                  type="color"
                  value={formData.text_color}
                  onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duração (segundos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={3}
                  max={30}
                  value={formData.duration_seconds}
                  onChange={(e) => setFormData({ ...formData, duration_seconds: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Opacidade do overlay: {Math.round(formData.overlay_opacity * 100)}%</Label>
              <Slider
                value={[formData.overlay_opacity * 100]}
                onValueChange={([value]) => setFormData({ ...formData, overlay_opacity: value / 100 })}
                min={0}
                max={80}
                step={5}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Banner ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.image_url || createBanner.isPending || updateBanner.isPending}
            >
              {(createBanner.isPending || updateBanner.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingBannerId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover banner?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O banner será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
