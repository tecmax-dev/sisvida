import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, Lock, CheckCircle, KeyRound } from "lucide-react";
import { extractFunctionsErrorAsync } from "@/lib/functionsError";

type Step = "email" | "verify_code" | "validate_birth_year" | "password" | "success";

export default function MobilePasswordResetPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const emailFromQuery = searchParams.get("email")?.trim();
    const codeFromQuery = searchParams.get("code")?.trim();

    if (!emailFromQuery || !emailFromQuery.includes("@")) {
      return;
    }

    setEmail((currentEmail) => currentEmail || emailFromQuery);
    
    if (codeFromQuery && codeFromQuery.length === 6) {
      setCode(codeFromQuery);
      setStep("validate_birth_year");
    } else {
      setStep((currentStep) => currentStep === "email" ? "verify_code" : currentStep);
    }
  }, [searchParams]);

  const sendResetCode = async (channel: "whatsapp" | "sms") => {
    if (!email || !email.includes("@")) {
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
        body: JSON.stringify({ email, channel }),
      });

      const rawText = await response.text();
      let data: any = null;
      try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText; }

      if (!response.ok) {
        const serverMessage =
          (data && typeof data === "object" && (data.error || data.message)) ||
          (typeof data === "string" && data) ||
          `Erro HTTP ${response.status}`;
        throw new Error(serverMessage);
      }

      const result = (data ?? {}) as { error?: string; message?: string };
      if (result.error) throw new Error(result.error);

      setStep("verify_code");
      toast({
        title: "Instruções enviadas",
        description:
          result.message ||
          (channel === "sms"
            ? "Se o email estiver cadastrado, você receberá um código por SMS."
            : "Se o email estiver cadastrado, você receberá um código de recuperação no WhatsApp."),
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

    setStep("validate_birth_year");
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
      const { data, error } = await supabase.rpc("reset_patient_password_by_code", {
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
      case "email":
        return (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-emerald-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Recuperar Senha</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Digite seu email cadastrado para receber um código de recuperação no WhatsApp.
              </p>
            </div>

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

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={loading || !email}
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
                Digite o <strong>código de 6 dígitos</strong> que enviamos para o seu WhatsApp.
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
                if (step === "email") navigate("/app");
                else if (step === "verify_code") setStep("email");
                else if (step === "validate_birth_year") setStep("verify_code");
                else if (step === "password") setStep("validate_birth_year");
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
          <p>© 2026 ProsindWeb</p>
          <p className="mt-1">Todos os Direitos Reservados</p>
        </div>
      </div>
    </div>
  );
}
