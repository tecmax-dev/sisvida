import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { PopupNotice, PopupNoticeInput, useUploadPopupImage } from "@/hooks/usePopupNotices";

interface PopupNoticeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PopupNoticeInput) => void;
  isLoading: boolean;
  clinicId: string;
  editingNotice?: PopupNotice | null;
}

export function PopupNoticeFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  clinicId,
  editingNotice,
}: PopupNoticeFormDialogProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("Entendi");
  const [buttonLink, setButtonLink] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showOncePerSession, setShowOncePerSession] = useState(true);
  const [priority, setPriority] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const uploadImage = useUploadPopupImage();

  useEffect(() => {
    if (editingNotice) {
      setTitle(editingNotice.title);
      setMessage(editingNotice.message || "");
      setImageUrl(editingNotice.image_url || "");
      setButtonText(editingNotice.button_text || "Entendi");
      setButtonLink(editingNotice.button_link || "");
      setIsActive(editingNotice.is_active);
      setShowOncePerSession(editingNotice.show_once_per_session);
      setPriority(editingNotice.priority);
      setStartsAt(editingNotice.starts_at ? editingNotice.starts_at.slice(0, 16) : "");
      setExpiresAt(editingNotice.expires_at ? editingNotice.expires_at.slice(0, 16) : "");
    } else {
      resetForm();
    }
  }, [editingNotice, open]);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setImageUrl("");
    setButtonText("Entendi");
    setButtonLink("");
    setIsActive(true);
    setShowOncePerSession(true);
    setPriority(0);
    setStartsAt("");
    setExpiresAt("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImage.mutateAsync(file);
    setImageUrl(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      clinic_id: clinicId,
      title,
      message: message || null,
      image_url: imageUrl || null,
      button_text: buttonText || "Entendi",
      button_link: buttonLink || null,
      is_active: isActive,
      show_once_per_session: showOncePerSession,
      priority,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingNotice ? "Editar Aviso Pop-up" : "Novo Aviso Pop-up"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aviso Importante"
              required
            />
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem do aviso..."
              rows={4}
            />
          </div>

          {/* Imagem */}
          <div className="space-y-2">
            <Label>Imagem (opcional)</Label>
            {imageUrl ? (
              <div className="relative">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => setImageUrl("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploadImage.isPending ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Clique para fazer upload
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadImage.isPending}
                />
              </label>
            )}
          </div>

          {/* Botão */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buttonText">Texto do Botão</Label>
              <Input
                id="buttonText"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="Entendi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buttonLink">Link do Botão</Label>
              <Input
                id="buttonLink"
                value={buttonLink}
                onChange={(e) => setButtonLink(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade (maior = aparece primeiro)</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              min={0}
            />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Início (opcional)</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expiração (opcional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          {/* Switches */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Aviso aparecerá no app
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Mostrar uma vez por sessão</Label>
                <p className="text-sm text-muted-foreground">
                  Evita que o aviso apareça repetidamente
                </p>
              </div>
              <Switch checked={showOncePerSession} onCheckedChange={setShowOncePerSession} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading || !title}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingNotice ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
