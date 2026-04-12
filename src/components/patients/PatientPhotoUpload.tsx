import { useState, useRef, useEffect } from "react";
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

/**
 * Resolve a patient photo URL - if it's a storage path, create a signed URL.
 * If it's already a full URL (legacy), return as-is.
 */
async function resolvePhotoUrl(url: string): Promise<string> {
  // If it's a relative path (not a full URL), create a signed URL
  if (!url.startsWith("http")) {
    const { data } = await supabase.storage
      .from("patient-photos")
      .createSignedUrl(url, 3600); // 1 hour
    return data?.signedUrl || url;
  }
  // Legacy full URLs - try to extract path and create signed URL
  const pathMatch = url.match(/patient-photos\/(.+?)(?:\?|$)/);
  if (pathMatch) {
    const { data } = await supabase.storage
      .from("patient-photos")
      .createSignedUrl(pathMatch[1], 3600);
    return data?.signedUrl || url;
  }
  return url;
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
  const [storedUrl, setStoredUrl] = useState<string | null>(currentPhotoUrl || null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sync with prop changes
  useEffect(() => {
    if (currentPhotoUrl !== undefined && currentPhotoUrl !== storedUrl && !uploading) {
      setStoredUrl(currentPhotoUrl);
    }
  }, [currentPhotoUrl]);

  // Resolve display URL whenever storedUrl changes
  useEffect(() => {
    if (!storedUrl) {
      setDisplayUrl(null);
      return;
    }
    let cancelled = false;
    resolvePhotoUrl(storedUrl).then((url) => {
      if (!cancelled) setDisplayUrl(url);
    });
    return () => { cancelled = true; };
  }, [storedUrl]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

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
      if (storedUrl) {
        const pathMatch = storedUrl.match(/patient-photos\/(.+?)(?:\?|$)/);
        const oldPath = pathMatch ? pathMatch[1] : storedUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("patient-photos").remove([oldPath]);
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `${patientId}/photo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-photos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the file path (not a public URL) in the database
      const { error: updateError } = await supabase
        .from("patients")
        .update({ photo_url: filePath })
        .eq("id", patientId);

      if (updateError) throw updateError;

      setStoredUrl(filePath);
      onPhotoChange?.(filePath);

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
    if (!storedUrl) return;

    setUploading(true);

    try {
      const pathMatch = storedUrl.match(/patient-photos\/(.+?)(?:\?|$)/);
      const path = pathMatch ? pathMatch[1] : storedUrl;
      await supabase.storage.from("patient-photos").remove([path]);

      const { error: updateError } = await supabase
        .from("patients")
        .update({ photo_url: null })
        .eq("id", patientId);

      if (updateError) throw updateError;

      setStoredUrl(null);
      setDisplayUrl(null);
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
      <div className="w-24 h-32 rounded-lg border-2 border-muted overflow-hidden bg-muted/30 relative">
        {displayUrl ? (
          <img
            src={displayUrl}
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

        {uploading && displayUrl && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

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

          {storedUrl && (
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
