import { useState, useRef, useCallback, useEffect } from "react";
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
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
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
    setCameraActive(false);

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

      if (mountedRef.current) {
        onUpload(publicUrl);
        toast({
          title: "Documento enviado",
          description: "Arquivo enviado com sucesso.",
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      if (mountedRef.current) {
        toast({
          title: "Erro no upload",
          description: error.message || "Não foi possível enviar o arquivo.",
          variant: "destructive",
        });
      }
    } finally {
      if (mountedRef.current) {
        setUploading(false);
      }
    }
  }, [sindicatoId, type, onUpload, toast]);

  const handleClear = useCallback(() => {
    onClear?.();
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }, [onClear]);

  const handleCameraClick = useCallback(() => {
    console.log('[DocumentUpload] Camera button clicked');
    setCameraActive(true);
    // Use setTimeout to ensure state is saved before camera opens
    setTimeout(() => {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }, 100);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DocumentUpload] File input changed');
    setCameraActive(false);
    if (e.target.files?.[0]) {
      handleFileUpload(e.target.files[0]);
    }
  }, [handleFileUpload]);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-xs font-medium text-gray-600 block text-center">{label}</label>
      
      <div
        className={cn(
          "border-2 border-dashed rounded-xl transition-all min-h-[130px] sm:min-h-[140px] flex items-center justify-center",
          documentUrl
            ? "border-green-400 bg-green-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
        )}
      >
        {documentUrl ? (
          <div className="flex flex-col items-center gap-2 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-xs sm:text-sm font-medium text-green-700">Enviado</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-gray-500 hover:text-red-600 h-7 text-xs"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Remover
            </Button>
          </div>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-2 p-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-xs text-gray-500">Enviando...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            
            {description && (
              <p className="text-[10px] sm:text-xs text-gray-500 text-center leading-tight">{description}</p>
            )}
            
            <div className="flex flex-col sm:flex-row gap-1.5 w-full max-w-[100px] sm:max-w-none">
              {isMobile && accept.includes("image") && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleCameraClick}
                  disabled={cameraActive || uploading}
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-2"
                >
                  {cameraActive ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3 mr-1" />
                  )}
                  Câmera
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-7 text-xs px-2"
              >
                <Upload className="h-3 w-3 mr-1" />
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
        onChange={handleFileChange}
        disabled={uploading}
      />

      {/* Input para câmera (mobile) */}
      {isMobile && accept.includes("image") && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          onClick={() => console.log('[DocumentUpload] Camera input clicked')}
          disabled={uploading}
        />
      )}
    </div>
  );
}
