import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HomologacaoProfessionalAvatarProps {
  professionalId: string;
  currentAvatarUrl?: string | null;
  professionalName?: string;
  onAvatarChange?: (url: string | null) => void;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  className?: string;
}

export function HomologacaoProfessionalAvatar({
  professionalId,
  currentAvatarUrl,
  professionalName = "P",
  onAvatarChange,
  size = "md",
  editable = true,
  className,
}: HomologacaoProfessionalAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-20 w-20",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);

    try {
      // Criar nome único para o arquivo
      const fileExt = file.name.split(".").pop();
      const fileName = `${professionalId}/avatar-${Date.now()}.${fileExt}`;

      // Deletar avatar anterior se existir
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/professional-avatars/")[1];
        if (oldPath) {
          await supabase.storage.from("professional-avatars").remove([oldPath]);
        }
      }

      // Upload do novo avatar
      const { error: uploadError } = await supabase.storage
        .from("professional-avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("professional-avatars")
        .getPublicUrl(fileName);

      const newAvatarUrl = urlData.publicUrl;

      // Atualizar profissional no banco
      const { error: updateError } = await supabase
        .from("homologacao_professionals")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", professionalId);

      if (updateError) throw updateError;

      setAvatarUrl(newAvatarUrl);
      onAvatarChange?.(newAvatarUrl);
      toast.success("Avatar atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao atualizar avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return;

    setUploading(true);

    try {
      // Remover do storage
      const oldPath = avatarUrl.split("/professional-avatars/")[1];
      if (oldPath) {
        await supabase.storage.from("professional-avatars").remove([oldPath]);
      }

      // Atualizar profissional
      const { error } = await supabase
        .from("homologacao_professionals")
        .update({ avatar_url: null })
        .eq("id", professionalId);

      if (error) throw error;

      setAvatarUrl(null);
      onAvatarChange?.(null);
      toast.success("Avatar removido");
    } catch (error: any) {
      console.error("Erro ao remover avatar:", error);
      toast.error("Erro ao remover avatar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar className={cn(sizeClasses[size], "border-2 border-border")}>
        <AvatarImage src={avatarUrl || undefined} alt={professionalName} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {uploading ? (
            <Loader2 className={cn(iconSizes[size], "animate-spin")} />
          ) : (
            getInitials(professionalName)
          )}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={cn(
              "absolute -bottom-1 -right-1 rounded-full shadow-md",
              size === "sm" ? "h-5 w-5" : size === "md" ? "h-6 w-6" : "h-8 w-8"
            )}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className={cn(size === "lg" ? "h-4 w-4" : "h-3 w-3")} />
          </Button>

          {avatarUrl && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className={cn(
                "absolute -top-1 -right-1 rounded-full shadow-md",
                size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-6 w-6"
              )}
              onClick={handleRemoveAvatar}
              disabled={uploading}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
