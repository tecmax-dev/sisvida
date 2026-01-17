import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload, Loader2, CheckCircle2, X, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PhotoUploadWithCameraProps {
  sindicatoId: string;
  photoUrl: string | null;
  onUpload: (url: string) => void;
  onClear?: () => void;
  label?: string;
  aspectRatio?: "portrait" | "square";
  className?: string;
}

export function PhotoUploadWithCamera({
  sindicatoId,
  photoUrl,
  onUpload,
  onClear,
  label = "Foto (3x4)",
  aspectRatio = "portrait",
  className,
}: PhotoUploadWithCameraProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é de 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Selecione uma imagem (JPG, PNG, etc).",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${sindicatoId}/${Date.now()}_foto.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("sindical-documentos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("sindical-documentos")
        .getPublicUrl(fileName);

      onUpload(publicUrl);
      toast({
        title: "Foto enviada",
        description: "Sua foto foi enviada com sucesso.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível enviar a foto.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    onClear?.();
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg overflow-hidden transition-colors",
          photoUrl 
            ? "border-green-400 bg-green-50" 
            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50",
          aspectRatio === "portrait" ? "aspect-[3/4]" : "aspect-square"
        )}
      >
        {photoUrl ? (
          <div className="relative w-full h-full group">
            <img
              src={photoUrl}
              alt="Foto"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClear}
              >
                <X className="h-4 w-4 mr-1" />
                Remover
              </Button>
            </div>
            <div className="absolute bottom-2 right-2">
              <CheckCircle2 className="h-6 w-6 text-green-500 bg-white rounded-full" />
            </div>
          </div>
        ) : uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
            <p className="text-xs text-gray-500">Enviando...</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <User className="h-8 w-8 text-gray-400" />
            </div>
            
            <div className="flex flex-col gap-2 w-full max-w-[160px]">
              {isMobile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Tirar Foto
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isMobile ? "Galeria" : "Enviar"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Input para arquivo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        disabled={uploading}
      />

      {/* Input para câmera (mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        disabled={uploading}
      />
    </div>
  );
}
