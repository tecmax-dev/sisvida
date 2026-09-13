import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, CheckCircle2, X, FileText, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadWithProgress } from "@/lib/uploadWithProgress";

interface DocumentUploadProps {
  sindicatoId: string;
  documentUrl: string | null;
  onUpload: (url: string) => void;
  onClear?: () => void;
  onUploadingChange?: (uploading: boolean) => void;
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
  onUploadingChange,
  label,
  description,
  accept = "image/*,application/pdf",
  type,
  className,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
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

    // Validar tamanho (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é de 20MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    setProgressMessage("Preparando arquivo...");
    setCameraActive(false);

    try {
      const fileExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg";
      const fileName = `${sindicatoId}/${Date.now()}_${type}.${fileExt}`;

      await uploadWithProgress({
        bucket: "sindical-documentos",
        path: fileName,
        file,
        onProgress: (s) => {
          if (!mountedRef.current) return;
          setProgress(s.percent);
          setProgressMessage(s.message);
        },
      });

      if (mountedRef.current) setProgressMessage("Gerando link seguro do documento...");

      // Bucket é privado. Usuários anônimos não têm permissão de SELECT,
      // então a URL assinada é gerada no servidor (edge function).
      let publicUrl: string | null = null;
      const { data: signed } = await supabase.storage
        .from("sindical-documentos")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10);
      publicUrl = signed?.signedUrl ?? null;

      if (!publicUrl) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "sindical-doc-sign",
          { body: { path: fileName } }
        );
        if (fnError || !fnData?.signedUrl) {
          throw new Error(fnData?.error || fnError?.message || "Falha ao gerar URL do documento");
        }
        publicUrl = fnData.signedUrl as string;
      }

      if (mountedRef.current) {
        onUpload(publicUrl);
        setProgress(100);
        setProgressMessage("Envio concluído!");
        toast({
          title: "Documento enviado",
          description: "Arquivo enviado com sucesso.",
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      if (mountedRef.current) {
        setProgressMessage("");
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
      onUploadingChange?.(false);
    }
  }, [sindicatoId, type, onUpload, onUploadingChange, toast]);

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
          <div className="flex flex-col items-center gap-2 p-3 w-full">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <Progress value={progress} className="h-1.5 w-[85%]" />
            <span className="text-[10px] sm:text-xs text-gray-500 text-center leading-tight">
              {progressMessage || "Enviando..."}
            </span>
            <span className="text-[10px] text-gray-400">Não feche esta página</span>
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
