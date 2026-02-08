import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Pen, Trash2 } from "lucide-react";

interface TokenData {
  id: string;
  patient_id: string;
  clinic_id: string;
  email: string;
  expires_at: string;
  used_at: string | null;
  patient: {
    name: string;
    cpf: string;
    employer_name: string | null;
  };
  union_entity: {
    razao_social: string;
    logo_url: string | null;
  } | null;
}

export default function SignatureAuthorizationPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token inválido");
      setLoading(false);
      return;
    }

    const fetchTokenData = async () => {
      try {
        // Fetch token with associado data
        const { data: tokenRecord, error: tokenError } = await supabase
          .from('signature_request_tokens')
          .select(`
            id,
            patient_id,
            clinic_id,
            email,
            expires_at,
            used_at
          `)
          .eq('token', token)
          .maybeSingle();

        if (tokenError || !tokenRecord) {
          setError("Link inválido ou expirado");
          setLoading(false);
          return;
        }

        // Check if already used
        if (tokenRecord.used_at) {
          setError("Este link já foi utilizado");
          setLoading(false);
          return;
        }

        // Check if expired
        if (new Date(tokenRecord.expires_at) < new Date()) {
          setError("Este link expirou. Solicite um novo link ao sindicato.");
          setLoading(false);
          return;
        }

        // Fetch patient (sócio) data
        const { data: patient } = await supabase
          .from('patients')
          .select('name, cpf, employer_name, signature_accepted')
          .eq('id', tokenRecord.patient_id)
          .maybeSingle();

        // Check if patient already signed
        if (patient?.signature_accepted) {
          setError("Esta autorização já foi assinada anteriormente. Não é necessário assinar novamente.");
          setLoading(false);
          return;
        }

        // Fetch union entity
        const { data: unionEntity } = await supabase
          .from('union_entities')
          .select('razao_social, logo_url')
          .eq('clinic_id', tokenRecord.clinic_id)
          .maybeSingle();

        setTokenData({
          ...tokenRecord,
          patient: patient!,
          union_entity: unionEntity,
        });
      } catch (err) {
        console.error('Error fetching token:', err);
        setError("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };

    fetchTokenData();
  }, [token]);

  // Canvas drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Set drawing styles
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [tokenData]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    
    // Save signature data
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setSignatureData(null);
  };

  const handleSubmit = async () => {
    if (!accepted) {
      toast.error("Você precisa aceitar os termos para continuar");
      return;
    }

    if (!signatureData || !hasDrawn) {
      toast.error("Por favor, assine no campo acima");
      return;
    }

    if (!tokenData) return;

    setSubmitting(true);
    try {
      // Update patient with signature
      const { error: updateError } = await supabase
        .from('patients')
        .update({
          signature_url: signatureData,
          signature_accepted: true,
          signature_accepted_at: new Date().toISOString(),
        })
        .eq('id', tokenData.patient_id);

      if (updateError) throw updateError;

      // Mark token as used
      await supabase
        .from('signature_request_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      setSuccess(true);
      toast.success("Autorização assinada com sucesso!");
    } catch (err: any) {
      console.error('Error submitting signature:', err);
      toast.error("Erro ao salvar assinatura. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-100">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Inválido</h2>
              <p className="text-gray-600">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Autorização Assinada!</h2>
              <p className="text-gray-600">
                Sua autorização de desconto em folha foi registrada com sucesso.
              </p>
              <p className="text-sm text-gray-500 mt-4">
                Você pode fechar esta página.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {tokenData?.union_entity?.logo_url && (
            <img 
              src={tokenData.union_entity.logo_url} 
              alt="Logo" 
              className="h-16 mx-auto mb-4"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {tokenData?.union_entity?.razao_social || "Sindicato"}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pen className="h-5 w-5 text-violet-600" />
              Autorização de Desconto em Folha
            </CardTitle>
            <CardDescription>
              Complete os dados abaixo para autorizar o desconto da contribuição sindical
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Member Info */}
            <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
              <h3 className="font-medium text-gray-900 mb-2">Dados do Associado</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nome:</span>
                  <span className="font-medium">{tokenData?.patient.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CPF:</span>
                  <span className="font-mono">{formatCPF(tokenData?.patient.cpf || "")}</span>
                </div>
                {tokenData?.patient.employer_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Empresa:</span>
                    <span>{tokenData.patient.employer_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Authorization Text */}
            <div className="bg-gray-50 rounded-lg p-4 border text-sm text-gray-700 leading-relaxed">
              <p className="mb-3">
                <strong>AUTORIZAÇÃO PARA DESCONTO EM FOLHA DE PAGAMENTO</strong>
              </p>
              <p className="mb-3">
                Autorizo expressamente meu empregador a descontar mensalmente de minha folha de 
                pagamento o valor correspondente à contribuição sindical em favor do{" "}
                <strong>{tokenData?.union_entity?.razao_social || "Sindicato"}</strong>, 
                conforme estabelecido em convenção coletiva de trabalho ou estatuto social.
              </p>
              <p>
                Esta autorização é válida a partir desta data e permanecerá em vigor até que 
                seja expressamente revogada por mim, por escrito.
              </p>
            </div>

            {/* Signature Canvas */}
            <div>
              <Label className="mb-2 block">Sua Assinatura</Label>
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white">
                <canvas
                  ref={canvasRef}
                  className="w-full h-40 cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-400 text-sm">Assine aqui com o mouse ou dedo</p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCanvas}
                className="mt-2"
                disabled={!hasDrawn}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <Checkbox
                id="terms"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked === true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="terms" className="text-sm font-medium cursor-pointer">
                  Li e concordo com os termos da autorização
                </Label>
                <p className="text-xs text-amber-700 mt-1">
                  Ao assinar, você autoriza o desconto mensal em folha de pagamento.
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p>
                Esta autorização tem validade legal e será registrada eletronicamente 
                com data e hora.
              </p>
            </div>

            {/* Submit Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || !accepted || !hasDrawn}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Autorização
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Documento eletrônico protegido por criptografia
        </p>
      </div>
    </div>
  );
}
