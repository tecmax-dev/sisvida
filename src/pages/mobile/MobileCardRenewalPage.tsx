import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Loader2, 
  Upload,
  Camera,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { format, isPast, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMobileAuth } from "@/contexts/MobileAuthContext";

interface CardData {
  id: string;
  card_number: string;
  expires_at: string | null;
  is_active: boolean;
}

interface PayslipRequest {
  id: string;
  status: string;
  requested_at: string;
  received_at: string | null;
  reviewed_at: string | null;
}

// Storage key for persisting state during camera capture
const CAMERA_STATE_KEY = 'mobile_card_renewal_state';

/**
 * MOBILE CARD RENEWAL PAGE - Arquitetura Bootstrap Imperativo
 * 
 * ❌ PROIBIDO: restoreSession, getSessionSync, navigate("/app/login")
 * ✅ PERMITIDO: useMobileAuth() para consumir dados já validados
 * 
 * NOTA: Implementação robusta para captura de câmera em WebView
 * - Salva estado antes de abrir a câmera
 * - Restaura estado após retorno da câmera
 * - Evita crash por perda de contexto
 */
export default function MobileCardRenewalPage() {
  const [loading, setLoading] = useState(true);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PayslipRequest | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Consumir dados do contexto de autenticação (já validado pelo bootstrap)
  const { patientId, clinicId } = useMobileAuth();

  // Persist state before camera opens (WebView can lose state)
  const persistState = useCallback(() => {
    try {
      const state = {
        cardDataId: cardData?.id,
        patientId,
        clinicId,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(CAMERA_STATE_KEY, JSON.stringify(state));
      console.log('[MobileCardRenewal] State persisted before camera');
    } catch (e) {
      console.warn('[MobileCardRenewal] Failed to persist state:', e);
    }
  }, [cardData, patientId, clinicId]);

  // Check for restored state on mount
  useEffect(() => {
    try {
      const savedState = sessionStorage.getItem(CAMERA_STATE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // Only use if recent (within 5 minutes)
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          console.log('[MobileCardRenewal] Found saved state from camera');
        }
        // Clean up
        sessionStorage.removeItem(CAMERA_STATE_KEY);
      }
    } catch (e) {
      console.warn('[MobileCardRenewal] Failed to restore state:', e);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (patientId && clinicId) {
      loadData(patientId, clinicId);
    } else {
      setLoading(false);
    }
  }, [patientId, clinicId]);

  const loadData = async (pid: string, cid: string) => {
    try {
      // Check for any pending payslip request FIRST (regardless of card)
      const { data: pendingRequests } = await supabase
        .from("payslip_requests")
        .select("id, status, requested_at, received_at, reviewed_at")
        .eq("patient_id", pid)
        .eq("clinic_id", cid)
        .in("status", ["pending", "received"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingRequests && pendingRequests.length > 0) {
        setPendingRequest(pendingRequests[0]);
      }

      // Get card data
      const { data: card } = await supabase
        .from("patient_cards")
        .select("id, card_number, expires_at, is_active")
        .eq("patient_id", pid)
        .eq("clinic_id", cid)
        .eq("is_active", true)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (card) {
        setCardData(card);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const getCardStatus = () => {
    if (!cardData) {
      return { label: "Não emitida", color: "secondary" as const, expired: false };
    }
    if (!cardData.is_active) {
      return { label: "Inativa", color: "destructive" as const, expired: false };
    }
    if (cardData.expires_at) {
      const expiryDate = parseISO(cardData.expires_at);
      if (isPast(expiryDate)) {
        return { label: "Vencida", color: "destructive" as const, expired: true };
      }
      const daysUntilExpiry = differenceInDays(expiryDate, new Date());
      if (daysUntilExpiry <= 30) {
        return { label: `Vence em ${daysUntilExpiry} dias`, color: "outline" as const, expired: false };
      }
    }
    return { label: "Válida", color: "default" as const, expired: false };
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[MobileCardRenewal] handleFileSelect called');
    setCameraActive(false);
    
    const file = e.target.files?.[0];
    if (!file) {
      console.log('[MobileCardRenewal] No file selected');
      return;
    }

    console.log('[MobileCardRenewal] File selected:', file.name, file.type, file.size);

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Envie uma imagem (JPG, PNG) ou PDF.",
        variant: "destructive",
      });
      return;
    }

    if (!mountedRef.current) {
      console.log('[MobileCardRenewal] Component unmounted, skipping state update');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (mountedRef.current) {
          setPreviewUrl(reader.result as string);
        }
      };
      reader.onerror = () => {
        console.error('[MobileCardRenewal] FileReader error');
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  }, [toast]);

  const handleCameraClick = useCallback(() => {
    console.log('[MobileCardRenewal] Camera button clicked');
    // Persist state before opening camera
    persistState();
    setCameraActive(true);
    
    // Use setTimeout to ensure state is saved before camera opens
    setTimeout(() => {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }, 100);
  }, [persistState]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  const handleSubmit = async () => {
    if (!selectedFile || !cardData || !patientId || !clinicId) return;

    setUploading(true);

    try {
      // Generate unique file path - use contra-cheques bucket with correct path structure
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${clinicId}/${patientId}/${Date.now()}.${fileExt}`;

      // Upload file to contra-cheques storage bucket
      const { error: uploadError } = await supabase.storage
        .from('contra-cheques')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Erro ao fazer upload do arquivo: ${uploadError.message}`);
      }

      // Create payslip request record
      const { error: requestError } = await supabase
        .from('payslip_requests')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          card_id: cardData.id,
          status: 'received',
          received_at: new Date().toISOString(),
          attachment_path: fileName,
          notes: 'Enviado via app mobile - Atualização de Carteirinha',
        });

      if (requestError) {
        console.error("Request error:", requestError);
        throw new Error("Erro ao registrar solicitação");
      }

      toast({
        title: "Contracheque enviado!",
        description: "Seu documento foi enviado para análise.",
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error("Error uploading:", err);
      toast({
        title: "Erro ao enviar",
        description: err.message || "Não foi possível enviar o contracheque.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const status = getCardStatus();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Success state after submission
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Atualizar Carteirinha</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <CheckCircle2 className="h-20 w-20 text-emerald-500 mb-6" />
          <h2 className="text-2xl font-semibold text-foreground mb-3 text-center">Enviado com Sucesso!</h2>
          <p className="text-muted-foreground text-center mb-2">
            Seu contracheque foi enviado para análise.
          </p>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Você será notificado quando sua carteirinha for renovada.
          </p>
          <Button 
            className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/app/home")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  // Pending request state
  if (pendingRequest) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Atualizar Carteirinha</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <Clock className="h-20 w-20 text-amber-500 mb-6" />
          <h2 className="text-2xl font-semibold text-foreground mb-3 text-center">Aguardando Análise</h2>
          <p className="text-muted-foreground text-center mb-2">
            Você já enviou seu contracheque e ele está em análise.
          </p>
          <p className="text-sm text-muted-foreground text-center mb-2">
            Enviado em: {format(new Date(pendingRequest.received_at || pendingRequest.requested_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          <Badge variant="secondary" className="mb-8">
            Status: {pendingRequest.status === 'pending' ? 'Pendente' : 'Recebido'}
          </Badge>
          <Button 
            className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/app/home")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  // No card state
  if (!cardData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Atualizar Carteirinha</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <AlertCircle className="h-20 w-20 text-muted-foreground mb-6" />
          <h2 className="text-2xl font-semibold text-foreground mb-3 text-center">Carteirinha não encontrada</h2>
          <p className="text-muted-foreground text-center mb-8">
            Você ainda não possui uma carteirinha ativa. Entre em contato com o sindicato.
          </p>
          <Button 
            className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/app/home")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  // Main upload form
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
        <button onClick={() => navigate("/app/home")} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center pr-8">Atualizar Carteirinha</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Card Status */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <CreditCard className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Carteirinha</p>
                <p className="font-semibold">{cardData.card_number}</p>
                {cardData.expires_at && (
                  <p className="text-xs text-muted-foreground">
                    Validade: {format(parseISO(cardData.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
              <Badge variant={status.color}>{status.label}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 mb-1">Atualização de Carteirinha</p>
                <p className="text-sm text-amber-700">
                  Para renovar sua carteirinha, envie uma foto do seu contracheque mais recente. 
                  O documento será analisado pela equipe do sindicato.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Enviar Contracheque</h3>

            {selectedFile ? (
              <div className="space-y-4">
                {/* Preview */}
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  {previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="w-full h-48 object-contain"
                    />
                  ) : (
                    <div className="w-full h-48 flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-12 w-12 mb-2" />
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  )}
                  <button
                    onClick={handleClearFile}
                    className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Submit Button */}
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSubmit}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Enviar Contracheque
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Upload buttons */}
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed border-2 flex flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Escolher arquivo do celular</span>
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed border-2 flex flex-col gap-2"
                  onClick={handleCameraClick}
                  disabled={cameraActive}
                >
                  {cameraActive ? (
                    <>
                      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                      <span className="text-sm text-muted-foreground">Abrindo câmera...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tirar foto com a câmera</span>
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Formatos aceitos: JPG, PNG ou PDF (máx. 10MB)
                </p>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {/* Camera input - uses capture attribute for native camera */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileSelect}
              onClick={() => console.log('[MobileCardRenewal] Camera input clicked')}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Dicas para uma boa foto</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Capture todo o documento na imagem</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Garanta boa iluminação para leitura clara</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Verifique se os dados estão legíveis</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
