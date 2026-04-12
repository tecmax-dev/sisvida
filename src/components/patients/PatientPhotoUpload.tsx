import { useState, useRef } from "react";
import { Camera, X, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PatientPhotoUploadProps {
  patientId: string;
  currentPhotoUrl?: string | null;
  patientName?: string;
  onPhotoChange?: (url: string | null) => void;
  editable?: boolean;
  className?: string;
}

export function PatientPhotoUpload({
  patientId,
  currentPhotoUrl,
  patientName = "",
  onPhotoChange,
  editable = true,
  className,
}: PatientPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sync with prop changes
  if (currentPhotoUrl !== undefined && currentPhotoUrl !== photoUrl && !uploading) {
    setPhotoUrl(currentPhotoUrl);
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Delete old photo if exists
      if (photoUrl) {
        const oldPath = photoUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("patient-photos").remove([oldPath]);
      }

      // Upload new photo
      const fileExt = file.name.split(".").pop();
      const filePath = `${patientId}/photo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-photos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("patient-photos")
        .getPublicUrl(filePath);

      const newPhotoUrl = urlData.publicUrl;

      // Update patient record
      const { error: updateError } = await supabase
        .from("patients")
        .update({ photo_url: newPhotoUrl })
        .eq("id", patientId);

      if (updateError) throw updateError;

      setPhotoUrl(newPhotoUrl);
      onPhotoChange?.(newPhotoUrl);

      toast({
        title: "Foto atualizada",
        description: "A foto do associado foi atualizada com sucesso.",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Erro ao enviar foto",
        description: "Não foi possível enviar a foto. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!photoUrl) return;

    setUploading(true);

    try {
      // Extract path from URL
      const pathMatch = photoUrl.match(/patient-photos\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from("patient-photos").remove([pathMatch[1]]);
      }

      // Update patient record
      const { error: updateError } = await supabase
        .from("patients")
        .update({ photo_url: null })
        .eq("id", patientId);

      if (updateError) throw updateError;

      setPhotoUrl(null);
      onPhotoChange?.(null);

      toast({
        title: "Foto removida",
        description: "A foto do associado foi removida.",
      });
    } catch (error) {
      console.error("Error removing photo:", error);
      toast({
        title: "Erro ao remover foto",
        description: "Não foi possível remover a foto. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Photo container - 3x4 aspect ratio */}
      <div className="w-24 h-32 rounded-lg border-2 border-muted overflow-hidden bg-muted/30 relative">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={patientName || "Foto do associado"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <User className="h-12 w-12 text-muted-foreground/50" />
            )}
          </div>
        )}

        {uploading && photoUrl && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Action buttons */}
      {editable && (
        <div className="flex gap-1 mt-2 justify-center">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-3.5 w-3.5" />
          </Button>

          {photoUrl && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={handleRemovePhoto}
              disabled={uploading}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
