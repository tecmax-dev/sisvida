import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, MessageCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function WhatsappConsentPublicPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<any>(null);
  const [consent, setConsent] = useState(false);

  const token = searchParams.get("t");

  useEffect(() => {
    if (!token) {
      setError("Link de acesso inválido ou expirado.");
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        // Simulação de validação de token seguro (idealmente via RPC ou Edge Function)
        // Para a Etapa 5.2, assumimos que o token carrega o contexto do paciente de forma efêmera
        const { data, error: funcError } = await supabase.functions.invoke("validate-public-token", {
          body: { token, purpose: "whatsapp_consent" }
        });

        if (funcError || !data?.success) {
          throw new Error(data?.error || "Não foi possível validar seu acesso.");
        }

        setPatient(data.patient);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleConfirm = async () => {
    if (!patient || !consent) return;

    setSubmitting(true);
    try {
      const WHATSAPP_CONSENT_TERM_VERSION = "whatsapp_operational_v1_2026";
      const WHATSAPP_CONSENT_TEXT = "Autorizo o Sindicato a utilizar meu número de WhatsApp para comunicações relacionadas ao meu cadastro, carteirinha, atendimentos, agendamentos e serviços solicitados, conforme a Política de Privacidade.";

      const { error: insertError } = await supabase.from("whatsapp_consents").insert({
        tenant_id: patient.clinic_id,
        person_id: patient.id,
        phone: patient.phone,
        consent_status: "granted",
        purpose: "SERVICE_OPERATIONAL",
        source: "FORMULARIO_PUBLICO",
        term_version: WHATSAPP_CONSENT_TERM_VERSION,
        consent_text: WHATSAPP_CONSENT_TEXT,
        user_agent: navigator.userAgent
      });

      if (insertError) throw insertError;

      setSuccess(true);
      toast.success("Consentimento registrado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar consentimento.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <Card className="max-w-md w-full border-t-4 border-t-emerald-500">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-800 mb-2">Obrigado!</h2>
            <p className="text-slate-600 mb-6">
              Sua autorização foi registrada. Agora você poderá receber avisos sobre sua carteirinha e agendamentos pelo WhatsApp.
            </p>
            <Button onClick={() => window.close()} variant="outline" className="w-full">
              Fechar Janela
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-md w-full shadow-lg border-0">
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="h-5 w-5" />
            <CardTitle>Autorização WhatsApp</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            Olá, {patient?.name?.split(' ')[0]}. Confirme sua preferência de comunicação.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Para facilitar seu atendimento, o Sindicato solicita autorização para enviar avisos operacionais via WhatsApp.
            </p>

            <div className="flex items-start space-x-3 p-4 bg-slate-100 rounded-lg border border-slate-200">
              <Checkbox 
                id="consent" 
                checked={consent} 
                onCheckedChange={(checked) => setConsent(!!checked)}
                className="mt-1"
              />
              <div className="space-y-1">
                <label htmlFor="consent" className="text-sm font-medium leading-none cursor-pointer">
                  Autorizo o envio de mensagens
                </label>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Autorizo o Sindicato a utilizar meu número de WhatsApp para comunicações relacionadas ao meu cadastro, carteirinha, atendimentos e serviços solicitados.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-mono bg-slate-50 p-2 rounded">
              <ShieldCheck className="h-3 w-3" />
              Versão: whatsapp_operational_v1_2026
            </div>
          </div>

          <Button 
            className="w-full h-12 text-base font-semibold" 
            disabled={!consent || submitting}
            onClick={handleConfirm}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "Confirmar Autorização"}
          </Button>
          
          <p className="text-[10px] text-center text-slate-400">
            Você pode revogar este consentimento a qualquer momento em nossos canais oficiais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
