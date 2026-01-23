import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Trash2,
  Upload,
  Loader2,
  X,
  Images,
  ZoomIn,
} from "lucide-react";
import {
  useUnionAppAlbumPhotos,
  useAddAlbumPhoto,
  useDeleteAlbumPhoto,
  useUploadAlbumPhoto,
  UnionAppAlbum,
  UnionAppAlbumPhoto,
} from "@/hooks/useUnionAppAlbums";

interface AlbumPhotosDialogProps {
  album: UnionAppAlbum;
  isOpen: boolean;
  onClose: () => void;
}

export function AlbumPhotosDialog({ album, isOpen, onClose }: AlbumPhotosDialogProps) {
  const { data: photos, isLoading } = useUnionAppAlbumPhotos(album.id);
  const addPhoto = useAddAlbumPhoto();
  const deletePhoto = useDeleteAlbumPhoto();
  const uploadPhoto = useUploadAlbumPhoto();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<UnionAppAlbumPhoto | null>(null);

  const handleUploadPhotos = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      setIsUploading(true);
      setUploadProgress(0);

      const currentOrderIndex = photos?.length || 0;

      for (let i = 0; i < files.length; i++) {
        try {
          const url = await uploadPhoto.mutateAsync({ file: files[i] });
          await addPhoto.mutateAsync({
            album_id: album.id,
            image_url: url,
            title: null,
            description: null,
            order_index: currentOrderIndex + i,
          });
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        } catch (error) {
          console.error("Error uploading photo:", error);
        }
      }

      setIsUploading(false);
      setUploadProgress(0);
      // Reset input
      e.target.value = "";
    },
    [album.id, photos?.length, uploadPhoto, addPhoto]
  );

  const handleDeletePhoto = async () => {
    if (!deletingPhotoId) return;
    await deletePhoto.mutateAsync({ id: deletingPhotoId, albumId: album.id });
    setIsDeleteDialogOpen(false);
    setDeletingPhotoId(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Images className="h-5 w-5" />
                  {album.title}
                </DialogTitle>
                {album.description && (
                  <p className="text-sm text-muted-foreground mt-1">{album.description}</p>
                )}
              </div>
              <Badge variant="secondary">{photos?.length || 0} fotos</Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload Area */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <label className="cursor-pointer">
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Enviando... {uploadProgress}%
                    </span>
                    <div className="w-full max-w-xs bg-muted rounded-full h-2 mt-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <span className="text-sm text-muted-foreground block">
                      Clique ou arraste fotos para enviar
                    </span>
                    <span className="text-xs text-muted-foreground block mt-1">
                      Você pode selecionar múltiplas fotos de uma vez
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUploadPhotos}
                  disabled={isUploading}
                />
              </label>
            </div>

            {/* Photos Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : photos && photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto p-1">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                  >
                    <img
                      src={photo.image_url}
                      alt={photo.title || "Foto do álbum"}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewingPhoto(photo)}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setDeletingPhotoId(photo.id);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Images className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma foto neste álbum ainda</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Photo Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Foto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhoto}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePhoto.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Viewer */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/90">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
            onClick={() => setViewingPhoto(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          {viewingPhoto && (
            <img
              src={viewingPhoto.image_url}
              alt={viewingPhoto.title || "Foto"}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
