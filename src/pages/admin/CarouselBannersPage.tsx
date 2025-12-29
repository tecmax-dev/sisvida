import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { 
  useAllCarouselBanners, 
  useCreateCarouselBanner, 
  useUpdateCarouselBanner, 
  useDeleteCarouselBanner,
  useUploadBannerImage,
  CarouselBanner 
} from "@/hooks/useCarouselBanners";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
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
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical, 
  Image as ImageIcon,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  is_active: boolean;
}

const defaultFormData: BannerFormData = {
  title: "",
  subtitle: "",
  description: "",
  image_url: "",
  button_text: "",
  button_link: "",
  background_color: "#0f172a",
  text_color: "#ffffff",
  overlay_opacity: 0.5,
  is_active: true,
};

export default function CarouselBannersPage() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  
  const { data: banners, isLoading } = useAllCarouselBanners();
  const createBanner = useCreateCarouselBanner();
  const updateBanner = useUpdateCarouselBanner();
  const deleteBanner = useDeleteCarouselBanner();
  const uploadImage = useUploadBannerImage();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<CarouselBanner | null>(null);
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BannerFormData>(defaultFormData);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate("/admin");
    }
  }, [isSuperAdmin, navigate]);

  const handleOpenCreate = () => {
    setEditingBanner(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (banner: CarouselBanner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      description: banner.description || "",
      image_url: banner.image_url,
      button_text: banner.button_text || "",
      button_link: banner.button_link || "",
      background_color: banner.background_color || "#0f172a",
      text_color: banner.text_color || "#ffffff",
      overlay_opacity: banner.overlay_opacity ?? 0.5,
      is_active: banner.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImage.mutateAsync(file);
    setFormData(prev => ({ ...prev, image_url: url }));
  };

  const handleSubmit = async () => {
    if (!formData.image_url) return;

    if (editingBanner) {
      await updateBanner.mutateAsync({
        id: editingBanner.id,
        ...formData,
      });
    } else {
      const maxOrder = banners?.reduce((max, b) => Math.max(max, b.order_index), -1) ?? -1;
      await createBanner.mutateAsync({
        ...formData,
        order_index: maxOrder + 1,
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingBannerId) return;
    await deleteBanner.mutateAsync(deletingBannerId);
    setIsDeleteDialogOpen(false);
    setDeletingBannerId(null);
  };

  const handleToggleActive = async (banner: CarouselBanner) => {
    await updateBanner.mutateAsync({
      id: banner.id,
      is_active: !banner.is_active,
    });
  };

  const handleMoveUp = async (banner: CarouselBanner, index: number) => {
    if (index === 0 || !banners) return;
    const prevBanner = banners[index - 1];
    
    await Promise.all([
      updateBanner.mutateAsync({ id: banner.id, order_index: prevBanner.order_index }),
      updateBanner.mutateAsync({ id: prevBanner.id, order_index: banner.order_index }),
    ]);
  };

  const handleMoveDown = async (banner: CarouselBanner, index: number) => {
    if (!banners || index === banners.length - 1) return;
    const nextBanner = banners[index + 1];
    
    await Promise.all([
      updateBanner.mutateAsync({ id: banner.id, order_index: nextBanner.order_index }),
      updateBanner.mutateAsync({ id: nextBanner.id, order_index: banner.order_index }),
    ]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Banners do Carrossel</h1>
          <p className="text-muted-foreground">
            Gerencie os banners exibidos no carrossel da landing page
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Banner
        </Button>
      </div>

      {/* Preview Link */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Visualize os banners na landing page
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer">
                Ver Landing Page
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Banners List */}
      <div className="space-y-4">
        {banners?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nenhum banner cadastrado</p>
              <Button onClick={handleOpenCreate} variant="outline" className="mt-4">
                Criar primeiro banner
              </Button>
            </CardContent>
          </Card>
        ) : (
          banners?.map((banner, index) => (
            <Card key={banner.id} className={cn(!banner.is_active && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="relative w-40 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={banner.image_url}
                      alt={banner.title || "Banner"}
                      className="w-full h-full object-cover"
                    />
                    <div 
                      className="absolute inset-0"
                      style={{
                        backgroundColor: banner.background_color || '#0f172a',
                        opacity: (banner.overlay_opacity ?? 0.5) * 0.5
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold truncate">
                          {banner.title || "Sem título"}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {banner.subtitle || banner.description || "Sem descrição"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!banner.is_active && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {banner.button_text && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Botão: {banner.button_text} → {banner.button_link}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
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
                      disabled={index === (banners?.length ?? 0) - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(banner)}
                    >
                      {banner.is_active ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
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
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? "Editar Banner" : "Novo Banner"}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes do banner para exibição no carrossel
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Imagem de Fundo *</Label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="URL da imagem ou faça upload"
                    value={formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                  />
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Button variant="outline" className="gap-2" disabled={uploadImage.isPending}>
                    {uploadImage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload
                  </Button>
                </div>
              </div>
              {formData.image_url && (
                <div className="relative w-full h-40 rounded-lg overflow-hidden bg-muted mt-2">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundColor: formData.background_color,
                      opacity: formData.overlay_opacity
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="text-center">
                      <p 
                        className="text-sm font-medium uppercase tracking-wide"
                        style={{ color: formData.text_color }}
                      >
                        {formData.subtitle || "Subtítulo"}
                      </p>
                      <h3 
                        className="text-xl font-bold mt-1"
                        style={{ color: formData.text_color }}
                      >
                        {formData.title || "Título do Banner"}
                      </h3>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Content Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Título principal"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtítulo</Label>
                <Input
                  id="subtitle"
                  placeholder="Subtítulo ou tagline"
                  value={formData.subtitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição complementar"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Button Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="button_text">Texto do Botão</Label>
                <Input
                  id="button_text"
                  placeholder="Ex: Saiba Mais"
                  value={formData.button_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, button_text: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="button_link">Link do Botão</Label>
                <Input
                  id="button_link"
                  placeholder="Ex: #pricing ou /signup"
                  value={formData.button_link}
                  onChange={(e) => setFormData(prev => ({ ...prev, button_link: e.target.value }))}
                />
              </div>
            </div>

            {/* Visual Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="background_color">Cor do Overlay</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="background_color"
                    value={formData.background_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                    className="w-14 h-10 p-1"
                  />
                  <Input
                    value={formData.background_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="text_color">Cor do Texto</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="text_color"
                    value={formData.text_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                    className="w-14 h-10 p-1"
                  />
                  <Input
                    value={formData.text_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Opacidade do Overlay: {Math.round(formData.overlay_opacity * 100)}%</Label>
              <Slider
                value={[formData.overlay_opacity]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, overlay_opacity: value }))}
                min={0}
                max={1}
                step={0.05}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
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
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editingBanner ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir banner?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O banner será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {deleteBanner.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
