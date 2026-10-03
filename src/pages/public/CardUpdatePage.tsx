import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Upload, Camera, FileText, CheckCircle2, Clock, AlertCircle, CreditCard, X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

interface ValidateResponse {
  success: boolean;
  error?: string;
  patient?: { id: string; name: string; clinic_id: string };
  card?: { id: string; card_number: string; expires_at: string | null; is_active: boolean; patient_id?: string } | null;
  pending_request?: { id: string; status: string; requested_at: string; received_at: string | null } | null;
  update_required?: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_REQUIRED: "Link inválido.",
  TOKEN_INVALID: "Link de acesso inválido.",
  TOKEN_EXPIRED: "Este link expirou. Solicite um novo ao sindicato.",
  TOKEN_REVOKED: "Este link foi cancelado.",
  PATIENT_NOT_FOUND: "Associado não localizado.",
};

export default function CardUpdatePage() {
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ValidateResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Atualizar carteirinha | Sindexa";
    const validate = async () => {
      if (!token) {
        setError(ERROR_MESSAGES.TOKEN_REQUIRED);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/card-update-link`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "validate", token }),
          }
        );
        const json: ValidateResponse = await res.json();
        if (!json.success) {
          setError(ERROR_MESSAGES[json.error || ""] || "Não foi possível validar seu acesso.");
        } else {
          setData(json);
        }
      } catch {
        setError("Falha de conexão. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };
    validate();
  }, [token]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 10MB.", variant: "destructive" });
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Tipo inválido", description: "Envie JPG, PNG ou PDF.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!selectedFile || !data?.patient || !data.card) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("patientId", data.card.patient_id || data.patient.id);
      formData.append("clinicId", data.patient.clinic_id);
      formData.append("cardId", data.card.id);
      formData.append("token", token);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-payslip-upload`,
        { method: "POST", body: formData }
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.details || result?.error || "Não foi possível enviar o contracheque. Tente novamente.");
      }
      const ok = result?.auto_approved === true;
      setAutoApproved(ok);
      toast({
        title: ok ? "Carteirinha renovada!" : "Contracheque enviado!",
        description: ok ? "Seu contracheque foi validado automaticamente." : "Não foi possível aprovar automaticamente. Aguarde a validação manual pelo departamento responsável.",
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível enviar o contracheque. Tente novamente.";
      toast({ title: "Erro ao enviar", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4">
        <h1 className="text-lg font-semibold text-center">Atualizar carteirinha</h1>
      </header>
      <div className="p-4 max-w-md mx-auto space-y-4">{children}</div>
    </main>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-16 w-16 text-destructive mb-4" />
          <p className="text-foreground font-medium mb-2">Acesso não autorizado</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-16 w-16 text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">{autoApproved ? "Carteirinha Renovada!" : "Documento recebido com sucesso!"}</h2>
          <p className="text-muted-foreground mb-6">
            {autoApproved
              ? "Seu contracheque foi validado automaticamente e a validade da sua carteirinha foi atualizada."
              : "Não foi possível aprovar automaticamente. Aguarde a validação manual pelo departamento responsável."}
          </p>
          <div className="bg-muted p-4 rounded-lg w-full">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Protocolo</p>
            <p className="font-mono text-sm">{Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (data?.pending_request && data.pending_request.status === 'pending') {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-16 w-16 text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">Contracheque em análise</h2>
          <p className="text-sm text-muted-foreground">
            Já recebemos seu documento. Aguarde a validação da equipe do sindicato.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 bg-muted rounded-xl">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{data?.patient?.name}</p>
            <p className="font-semibold">{data?.card?.card_number || "Sem carteirinha ativa"}</p>
            {data?.card?.expires_at && (
              <p className="text-xs text-muted-foreground">
                Validade: {format(parseDateOnlyToLocalNoon(data.card.expires_at.slice(0, 10)), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </div>
          {data?.update_required && <Badge variant="destructive">Atualizar</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3">Enviar contracheque</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Envie uma foto ou PDF do seu contracheque mais recente para renovar sua carteirinha.
          </p>

          {selectedFile ? (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-muted">
                {previewUrl ? (
                  <img src={previewUrl} alt="Pré-visualização do contracheque enviado" className="w-full h-48 object-contain" />
                ) : (
                  <div className="w-full h-48 flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-10 w-10 mb-2" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                  </div>
                )}
                <button
                  onClick={handleClearFile}
                  aria-label="Remover arquivo"
                  className="absolute top-2 right-2 p-2 bg-foreground/50 rounded-full text-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={uploading || !data?.card}>
                {uploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />Enviar contracheque</>
                )}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />Câmera
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileText className="mr-2 h-4 w-4" />Arquivo
              </Button>
            </div>
          )}

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
        </CardContent>
      </Card>
    </Shell>
  );
}
