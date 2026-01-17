import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, CheckCircle2, X, FileText, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DocumentUploadProps {
  sindicatoId: string;
  documentUrl: string | null;
  onUpload: (url: string) => void;
  onClear?: () => void;
  label: string;
  description?: string;
  accept?: string;
  type: string;
  className?: string;
}

export function DocumentUpload({
  sindicatoId,
  documentUrl,
  onUpload,
  onClear,
  label,
  description,
  accept = "image/*,application/pdf",
  type,
  className,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é de 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${sindicatoId}/${Date.now()}_${type}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("sindical-documentos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("sindical-documentos")
        .getPublicUrl(fileName);

      onUpload(publicUrl);
      toast({
        title: "Documento enviado",
        description: "Arquivo enviado com sucesso.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível enviar o arquivo.",
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
          "border-2 border-dashed rounded-lg transition-colors h-[120px] flex items-center justify-center",
          documentUrl
            ? "border-green-400 bg-green-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
        )}
      >
        {documentUrl ? (
          <div className="flex flex-col items-center gap-2 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <span className="text-sm font-medium text-green-700">Enviado</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-gray-500 hover:text-red-600"
            >
              <X className="h-4 w-4 mr-1" />
              Remover
            </Button>
          </div>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="text-xs text-gray-500">Enviando...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
            
            {description && (
              <p className="text-xs text-gray-500 text-center">{description}</p>
            )}
            
            <div className="flex gap-2">
              {isMobile && accept.includes("image") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-1" />
                  Câmera
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                {isMobile ? "Arquivo" : "Enviar"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Input para arquivo */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        disabled={uploading}
      />

      {/* Input para câmera (mobile) */}
      {isMobile && accept.includes("image") && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          disabled={uploading}
        />
      )}
    </div>
  );
}
