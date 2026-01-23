import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Images,
  Loader2,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
import {
  useUnionAppAlbums,
  useCreateUnionAppAlbum,
  useUpdateUnionAppAlbum,
  useDeleteUnionAppAlbum,
  UnionAppAlbum,
} from "@/hooks/useUnionAppAlbums";
import { useUploadContentFile } from "@/hooks/useUnionAppContent";
import { AlbumPhotosDialog } from "./AlbumPhotosDialog";

interface AlbumFormData {
  title: string;
  description: string;
  cover_image_url: string;
  is_active: boolean;
  order_index: number;
}

const defaultFormData: AlbumFormData = {
  title: "",
  description: "",
  cover_image_url: "",
  is_active: true,
  order_index: 0,
};

export function AlbumManagementTab() {
  const { data: albums, isLoading } = useUnionAppAlbums();
  const createAlbum = useCreateUnionAppAlbum();
  const updateAlbum = useUpdateUnionAppAlbum();
  const deleteAlbum = useDeleteUnionAppAlbum();
  const uploadFile = useUploadContentFile();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPhotosDialogOpen, setIsPhotosDialogOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<UnionAppAlbum | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<UnionAppAlbum | null>(null);
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AlbumFormData>(defaultFormData);
  const [isUploading, setIsUploading] = useState(false);

  const handleOpenCreate = () => {
    setEditingAlbum(null);
    setFormData({
      ...defaultFormData,
      order_index: albums?.length || 0,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (album: UnionAppAlbum) => {
    setEditingAlbum(album);
    setFormData({
      title: album.title,
      description: album.description || "",
      cover_image_url: album.cover_image_url || "",
      is_active: album.is_active,
      order_index: album.order_index,
    });
    setIsDialogOpen(true);
  };

  const handleOpenPhotos = (album: UnionAppAlbum) => {
    setSelectedAlbum(album);
    setIsPhotosDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadFile.mutateAsync({ file, folder: "album-covers" });
      setFormData((prev) => ({ ...prev, cover_image_url: url }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;

    if (editingAlbum) {
      await updateAlbum.mutateAsync({
        id: editingAlbum.id,
        ...formData,
      });
    } else {
      await createAlbum.mutateAsync(formData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingAlbumId) return;
    await deleteAlbum.mutateAsync(deletingAlbumId);
    setIsDeleteDialogOpen(false);
    setDeletingAlbumId(null);
  };

  const handleToggleActive = async (album: UnionAppAlbum) => {
    await updateAlbum.mutateAsync({
      id: album.id,
      is_active: !album.is_active,
    });
  };

  const handleMoveUp = async (album: UnionAppAlbum, index: number) => {
    if (index === 0 || !albums) return;
    const prevAlbum = albums[index - 1];
    await updateAlbum.mutateAsync({ id: album.id, order_index: prevAlbum.order_index });
    await updateAlbum.mutateAsync({ id: prevAlbum.id, order_index: album.order_index });
  };

  const handleMoveDown = async (album: UnionAppAlbum, index: number) => {
    if (!albums || index === albums.length - 1) return;
    const nextAlbum = albums[index + 1];
    await updateAlbum.mutateAsync({ id: album.id, order_index: nextAlbum.order_index });
    await updateAlbum.mutateAsync({ id: nextAlbum.id, order_index: album.order_index });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!albums || albums.length === 0) {
    return (
      <>
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Images className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Nenhum álbum encontrado</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Crie seu primeiro álbum para organizar suas fotos
            </p>
            <Button onClick={handleOpenCreate} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Criar Álbum
            </Button>
          </CardContent>
        </Card>

        <AlbumDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          formData={formData}
          setFormData={setFormData}
          isUploading={isUploading}
          onImageUpload={handleImageUpload}
          onSubmit={handleSubmit}
          isEditing={!!editingAlbum}
          isPending={createAlbum.isPending || updateAlbum.isPending}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Álbum
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {albums.map((album, index) => (
          <Card
            key={album.id}
            className={`group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
              !album.is_active ? "opacity-60 grayscale" : ""
            }`}
          >
            {/* Cover Image */}
            <div
              className="relative aspect-video bg-muted overflow-hidden"
              onClick={() => handleOpenPhotos(album)}
            >
              {album.cover_image_url ? (
                <img
                  src={album.cover_image_url}
                  alt={album.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <Images className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge variant={album.is_active ? "default" : "secondary"} className="shadow-sm">
                  {album.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              {/* Photos count */}
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                  {album.photos_count || 0} fotos
                </Badge>
              </div>
            </div>

            {/* Content */}
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-base line-clamp-1">{album.title}</h3>
                  {album.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {album.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(album, index);
                      }}
                      disabled={index === 0}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(album, index);
                      }}
                      disabled={index === albums.length - 1}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={album.is_active}
                      onCheckedChange={() => handleToggleActive(album)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(album);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingAlbumId(album.id);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Album Form Dialog */}
      <AlbumDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        formData={formData}
        setFormData={setFormData}
        isUploading={isUploading}
        onImageUpload={handleImageUpload}
        onSubmit={handleSubmit}
        isEditing={!!editingAlbum}
        isPending={createAlbum.isPending || updateAlbum.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Álbum</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este álbum? Todas as fotos serão removidas também. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAlbum.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photos Dialog */}
      {selectedAlbum && (
        <AlbumPhotosDialog
          album={selectedAlbum}
          isOpen={isPhotosDialogOpen}
          onClose={() => {
            setIsPhotosDialogOpen(false);
            setSelectedAlbum(null);
          }}
        />
      )}
    </>
  );
}

// Album Form Dialog Component
interface AlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  formData: AlbumFormData;
  setFormData: React.Dispatch<React.SetStateAction<AlbumFormData>>;
  isUploading: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  isEditing: boolean;
  isPending: boolean;
}

function AlbumDialog({
  isOpen,
  onClose,
  formData,
  setFormData,
  isUploading,
  onImageUpload,
  onSubmit,
  isEditing,
  isPending,
}: AlbumDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar" : "Novo"} Álbum</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize as informações do álbum" : "Crie um novo álbum de fotos"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Nome do álbum"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição opcional do álbum"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Imagem de Capa</Label>
            {formData.cover_image_url ? (
              <div className="relative group">
                <img
                  src={formData.cover_image_url}
                  alt="Capa do álbum"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setFormData((prev) => ({ ...prev, cover_image_url: "" }))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-4">
                <label className="flex flex-col items-center cursor-pointer">
                  {isUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Clique para enviar imagem
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onImageUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_active: checked }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!formData.title.trim() || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
