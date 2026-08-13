import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, Lock, CheckCircle, KeyRound, MessageSquare } from "lucide-react";
import { extractFunctionsErrorAsync } from "@/lib/functionsError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type Step = "identify" | "verify_code" | "validate_birth_year" | "password" | "success";
type Mode = "email" | "cpf";

const formatCpf = (value: string) => {
  const n = value.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
};

export default function MobilePasswordResetPage() {
  const [step, setStep] = useState<Step>("identify");
  const [mode, setMode] = useState<Mode>("cpf");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [code, setCode] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsAllowed, setSmsAllowed] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const checkSmsAvailability = async (payload: { cpf?: string; email?: string }) => {
    try {
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const anonKey = (supabase as any).supabaseKey as string;
      const url = `${supabaseUrl}/functions/v1/send-password-reset-email`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ ...payload, checkSmsLimit: true }),
      });
      const data = await response.json().catch(() => null);
      if (typeof data?.smsAllowed === "boolean") {
        setSmsAllowed(data.smsAllowed);
        return data.smsAllowed as boolean;
      }
    } catch (err) {
      console.warn("Failed to check SMS limit:", err);
    }
    return true;
  };

  useEffect(() => {
    const emailFromQuery = searchParams.get("email")?.trim();
    const codeFromQuery = searchParams.get("code")?.trim();

    if (!emailFromQuery || !emailFromQuery.includes("@")) {
      return;
    }

    setEmail((currentEmail) => currentEmail || emailFromQuery);
    setMode("email");

    if (codeFromQuery && codeFromQuery.length === 6) {
      setCode(codeFromQuery);
      setStep("validate_birth_year");
    } else {
      setStep((currentStep) => currentStep === "identify" ? "verify_code" : currentStep);
    }
  }, [searchParams]);

  const sendResetCode = async (channel: "whatsapp" | "sms" | "email") => {
    const isCpfMode = mode === "cpf";
    const cpfDigits = cpf.replace(/\D/g, "");

    if (isCpfMode) {
      if (cpfDigits.length !== 11) {
        toast({
          title: "CPF inválido",
          description: "Digite os 11 dígitos do seu CPF.",
          variant: "destructive",
        });
        return;
      }
    } else if (!email || !email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    if (channel === "sms") setSmsLoading(true); else setLoading(true);

    try {
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const anonKey = (supabase as any).supabaseKey as string;
      const url = `${supabaseUrl}/functions/v1/send-password-reset-email`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(
          isCpfMode ? { cpf: cpfDigits, channel: "sms" } : { email, channel },
        ),
      });

      const rawText = await response.text();
      let data: any = null;
      try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText; }

      if (!response.ok) {
        const serverMessage =
          (data && typeof data === "object" && (data.error || data.message)) ||
          (typeof data === "string" && data) ||
          `Erro HTTP ${response.status}`;
        if (data && typeof data === "object" && (data as any).code === "sms_limit_reached") {
          setSmsAllowed(false);
          if (isCpfMode) setMode("email");
          toast({
            title: "Limite de SMS atingido",
            description:
              "Você já recebeu 2 códigos por SMS nos últimos 15 dias. Use WhatsApp ou e-mail.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(serverMessage);
      }

      const result = (data ?? {}) as { error?: string; message?: string };
      if (result.error) throw new Error(result.error);

      setStep("verify_code");
      const defaultMsg =
        channel === "email"
          ? "Se o email estiver cadastrado, você receberá um código de recuperação por e-mail."
          : isCpfMode || channel === "sms"
            ? "Se o email estiver cadastrado, você receberá um código por SMS."
            : "Se o email estiver cadastrado, você receberá um código de recuperação no WhatsApp.";
      toast({
        title: "Instruções enviadas",
        description: result.message || defaultMsg,
      });
    } catch (err: any) {
      console.error("Error sending reset link:", err);
      const directMsg = err?.message;
      const parsed = await extractFunctionsErrorAsync(err);
      toast({
        title: "Erro ao enviar instruções",
        description:
          directMsg || parsed.message || "Não foi possível enviar as instruções de recuperação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      if (channel === "sms") setSmsLoading(false); else setLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendResetCode("whatsapp");
  };

  const handleSendSms = () => sendResetCode("sms");
  const handleSendEmail = () => sendResetCode("email");

  const handleCpfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (async () => {
      const cpfDigits = cpf.replace(/\D/g, "");
      if (cpfDigits.length === 11) {
        const allowed = await checkSmsAvailability({ cpf: cpfDigits });
        if (!allowed) {
          setMode("email");
          toast({
            title: "Limite de SMS atingido",
            description:
              "Você atingiu o limite de 2 envios de SMS em 15 dias. Use seu e-mail para receber o código por WhatsApp ou e-mail.",
            variant: "destructive",
          });
          return;
        }
      }
      sendResetCode("sms");
    })();
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      toast({
        title: "Código inválido",
        description: "Digite o código de 6 dígitos recebido no WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    // CPF flow skips birth-year validation
    setStep(mode === "cpf" ? "password" : "validate_birth_year");
  };

  const handleValidateBirthYear = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!birthYear || birthYear.length !== 4) {
      toast({
        title: "Ano inválido",
        description: "Digite o ano de nascimento com 4 dígitos (ex: 1980).",
        variant: "destructive",
      });
      return;
    }

    setStep("password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha não corresponde.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        mode === "cpf"
          ? await supabase.rpc("reset_patient_password_by_cpf_code", {
              p_cpf: cpf.replace(/\D/g, ""),
              p_code: code,
              p_new_password: newPassword,
            } as any)
          : await supabase.rpc("reset_patient_password_by_code", {
              p_email: email,
              p_code: code,
              p_birth_year: parseInt(birthYear),
              p_new_password: newPassword,
            } as any);

      if (error) {
        console.error("RPC error:", error);
        toast({
          title: "Erro",
          description: error.message || "Não foi possível redefinir a senha.",
          variant: "destructive",
        });
        return;
      }

      const result = data as Record<string, unknown> | null;

      if (!result?.success) {
        toast({
          title: "Erro",
          description: (result?.message as string) || "Não foi possível redefinir a senha.",
          variant: "destructive",
        });
        return;
      }

      setStep("success");
    } catch (err: any) {
      console.error("Error resetting password:", err);
      toast({
        title: "Erro",
        description: err?.message || "Não foi possível redefinir a senha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case "identify":
        return (
          <form onSubmit={mode === "cpf" ? handleCpfSubmit : handleEmailSubmit} className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                {mode === "cpf" ? (
                  <MessageSquare className="h-8 w-8 text-emerald-600" />
                ) : (
                  <Mail className="h-8 w-8 text-emerald-600" />
                )}
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Recuperar Senha</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {mode === "cpf"
                  ? "Digite seu CPF para receber um código por SMS no telefone cadastrado."
                  : "Digite seu email cadastrado para receber um código de recuperação no WhatsApp."}
              </p>
            </div>

            {!smsAllowed && (
              <Alert variant="destructive" className="mb-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Limite de SMS atingido</AlertTitle>
                <AlertDescription>
                  Você já recebeu 2 códigos por SMS nos últimos 15 dias. O envio por
                  SMS foi temporariamente desativado — utilize <strong>WhatsApp</strong>
                  {" "}ou <strong>e-mail</strong> abaixo para receber seu código.
                </AlertDescription>
              </Alert>
            )}

            {mode === "cpf" ? (
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  className="h-12"
                  disabled={loading || smsLoading}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  disabled={loading}
                />
              </div>
            )}

            {mode === "cpf" ? (
              <Button
                type="submit"
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={smsLoading || cpf.replace(/\D/g, "").length !== 11}
              >
                {smsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando SMS...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Enviar código por SMS
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={loading || smsLoading || !email}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar código por WhatsApp"
                  )}
                </Button>

                {smsAllowed && (
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-muted" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">ou</span>
                  </div>
                </div>
                )}

                {smsAllowed && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 font-semibold border-2"
                  disabled={loading || smsLoading || !email}
                  onClick={handleSendSms}
                >
                  {smsLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando SMS...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Enviar código por SMS
                    </>
                  )}
                </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 font-semibold border-2"
                  disabled={loading || smsLoading || !email}
                  onClick={handleSendEmail}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando e-mail...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar código por E-mail
                    </>
                  )}
                </Button>
              </>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                className="text-xs text-emerald-600 hover:underline"
                onClick={() => setMode(mode === "cpf" ? "email" : "cpf")}
                disabled={loading || smsLoading}
              >
                {mode === "cpf"
                  ? "Prefiro usar meu email"
                  : "Não lembro o email — usar meu CPF"}
              </button>
            </div>
          </form>
        );

      case "verify_code":
        return (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <KeyRound className="h-8 w-8 text-emerald-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Código de Recuperação</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Digite o <strong>código de 6 dígitos</strong> que enviamos para o seu {mode === "cpf" ? "SMS" : "WhatsApp"}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código de Recuperação</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                maxLength={6}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={!code || code.length !== 6}
            >
              Continuar
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              ⏱️ O código expira em 30 minutos. Não recebeu? Volte e tente novamente.
            </p>
          </form>
        );

      case "validate_birth_year":
        return (
          <form onSubmit={handleValidateBirthYear} className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Validar Identidade</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Para sua segurança, informe seu <strong>ano de nascimento</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthYear">Ano de Nascimento</Label>
              <Input
                id="birthYear"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 1985"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-12 text-center text-xl font-semibold"
                maxLength={4}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={birthYear.length !== 4}
            >
              Continuar
            </Button>
          </form>
        );

      case "password":
        return (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <Lock className="h-8 w-8 text-emerald-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Nova Senha</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Digite sua nova senha de acesso ao app.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-12"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                "Redefinir Senha"
              )}
            </Button>
          </form>
        );

      case "success":
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground">Senha Alterada!</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Sua senha foi redefinida com sucesso. Agora você pode fazer login com a nova senha.
              </p>
            </div>

            <Button
              onClick={() => navigate("/app")}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Ir para Login
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col">
      {/* Header */}
      <div className="bg-emerald-600 text-white py-6 px-4">
        <div className="flex items-center gap-4">
          {step !== "success" && (
            <button
              onClick={() => {
                if (step === "identify") navigate("/app");
                else if (step === "verify_code") setStep("identify");
                else if (step === "validate_birth_year") setStep("verify_code");
                else if (step === "password") setStep(mode === "cpf" ? "verify_code" : "validate_birth_year");
              }}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">SECMI</h1>
            <p className="text-xs opacity-90">Recuperação de Senha</p>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-2 p-6">
        <Card className="border-0 shadow-none">
          <CardContent className="px-0 pt-4">
            {renderStepContent()}
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 Prosinge</p>
          <p className="mt-1">Todos os Direitos Reservados</p>
        </div>
      </div>
    </div>
  );
}
