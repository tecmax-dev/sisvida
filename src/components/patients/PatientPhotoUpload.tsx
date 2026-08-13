import { useState, useRef } from "react";
import { Camera, X, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { uploadWithProgress } from "@/lib/uploadWithProgress";

interface PatientPhotoUploadProps {
  patientId: string;
  clinicId?: string;
  currentPhotoUrl?: string | null;
  patientName?: string;
  onPhotoChange?: (url: string | null) => void;
  editable?: boolean;
  className?: string;
}

export function PatientPhotoUpload({
  patientId,
  clinicId,
  currentPhotoUrl,
  patientName = "",
  onPhotoChange,
  editable = true,
  className,
}: PatientPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { currentClinic } = useAuth();
  const resolvedClinicId = clinicId || currentClinic?.id;

  // Extrai o caminho interno do bucket a partir da URL pública
  const extractPath = (url: string): string | null => {
    const match = url.match(/patient-photos\/(.+?)(\?|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

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
    setProgress(0);
    setProgressMessage("Preparando foto...");

    try {
      if (!resolvedClinicId) {
        throw new Error("Clínica não identificada. Recarregue a página e tente novamente.");
      }

      // Delete old photo if exists
      if (photoUrl) {
        setProgressMessage("Removendo foto anterior...");
        const oldPath = extractPath(photoUrl);
        if (oldPath) {
          await supabase.storage.from("patient-photos").remove([oldPath]);
        }
      }

      // Upload new photo
      const fileExt =
        (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg";
      // O caminho DEVE começar pelo clinic_id (exigido pelas políticas de storage)
      const filePath = `${resolvedClinicId}/${patientId}/photo-${Date.now()}.${fileExt}`;

      await uploadWithProgress({
        bucket: "patient-photos",
        path: filePath,
        file,
        upsert: true,
        onProgress: (s) => {
          setProgress(s.percent);
          setProgressMessage(s.message);
        },
      });

      setProgressMessage("Salvando no cadastro...");

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
      setProgress(100);
      setProgressMessage("");

      toast({
        title: "Foto atualizada",
        description: "A foto do associado foi atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      setProgressMessage("");
      toast({
        title: "Erro ao enviar foto",
        description: error?.message || "Não foi possível enviar a foto. Tente novamente.",
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
      const oldPath = extractPath(photoUrl);
      if (oldPath) {
        await supabase.storage.from("patient-photos").remove([oldPath]);
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

      {uploading && (
        <div className="mt-2 space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground text-center leading-tight">
            {progressMessage || "Enviando..."}
          </p>
        </div>
      )}

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
