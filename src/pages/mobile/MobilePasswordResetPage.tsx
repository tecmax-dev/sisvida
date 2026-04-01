import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, KeyRound, Lock, CheckCircle, ShieldCheck, MessageSquare } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "email" | "channel" | "code" | "verify_identity" | "password" | "success";

export default function MobilePasswordResetPage() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameFromLink, setCameFromLink] = useState(false);
  const [patientPhone, setPatientPhone] = useState<string | null>(null);
  const [patientHasEmail, setPatientHasEmail] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auto-fill from URL params (deep link from WhatsApp)
  useEffect(() => {
    const tokenParam = searchParams.get("token");
    const emailParam = searchParams.get("email");

    if (tokenParam) {
      setCode(tokenParam);
      if (emailParam) setEmail(emailParam);
      setCameFromLink(true);
      setStep("verify_identity");
    }
  }, [searchParams]);

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if patient exists and get contact info
      const { data, error } = await supabase.functions.invoke("send-password-reset-email", {
        body: { email, checkOnly: true },
      });

      if (error) throw error;

      if (data?.hasPhone || data?.hasEmail) {
        setPatientPhone(data.maskedPhone || null);
        setPatientHasEmail(!!data.hasEmail);

        // If only one channel available, go straight to sending
        if (data.hasPhone && !data.hasEmail) {
          await sendResetCode("whatsapp");
        } else if (!data.hasPhone && data.hasEmail) {
          await sendResetCode("email");
        } else {
          setStep("channel");
        }
      } else {
        // Generic success message to not reveal if account exists
        toast({
          title: "Código enviado!",
          description: "Se o email estiver cadastrado, você receberá o código de recuperação.",
        });
        setStep("code");
      }
    } catch (err: any) {
      console.error("Error checking email:", err);
      // Always show generic message for security
      toast({
        title: "Código enviado!",
        description: "Se o email estiver cadastrado, você receberá o código de recuperação.",
      });
      setStep("code");
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = async (channel: "email" | "whatsapp") => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset-email", {
        body: { email, channel },
      });

      if (error) throw error;

      if (channel === "whatsapp") {
        toast({
          title: "📱 Link enviado pelo WhatsApp!",
          description: "Enviamos um link de recuperação para o seu WhatsApp. Abra a conversa e clique no link para redefinir sua senha.",
          duration: 8000,
        });
      } else {
        toast({
          title: "📧 Código enviado por e-mail!",
          description: "Verifique sua caixa de entrada (e o spam) para obter o código de recuperação.",
          duration: 6000,
        });
      }

      setStep("code");
    } catch (err: any) {
      console.error("Error sending reset code:", err);

      let errorMessage = "Não foi possível enviar o código. Tente novamente.";
      try {
        const maybeContext = err?.context;
        if (maybeContext?.json) {
          const body = await maybeContext.json();
          if (body?.error && typeof body.error === "string") {
            errorMessage = body.error;
          }
        } else if (typeof err?.message === "string" && err.message.trim()) {
          errorMessage = err.message;
        }
      } catch {
        // ignore parsing errors
      }

      if (
        errorMessage.toLowerCase().includes("email não encontrado") ||
        errorMessage.toLowerCase().includes("sem senha")
      ) {
        errorMessage =
          "Não encontramos uma conta com esse e-mail (ou ela ainda não tem senha). Use a opção 'Primeiro acesso'.";
      }

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      toast({
        title: "Código incompleto",
        description: "Digite o código de 6 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setStep("verify_identity");
  };

  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!birthYear || birthYear.length !== 4) {
      toast({
        title: "Ano inválido",
        description: "Digite o ano de nascimento com 4 dígitos.",
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
      const rpcParams: Record<string, unknown> = {
        p_email: email,
        p_token: code,
        p_new_password: newPassword,
      };
      if (birthYear) {
        rpcParams.p_birth_year = parseInt(birthYear, 10);
      }

      const { data, error } = await supabase.rpc("reset_patient_password_with_token", rpcParams as any);

      if (error) {
        console.error("RPC error:", error);
        toast({
          title: "Erro",
          description: error.message || "Não foi possível redefinir a senha.",
          variant: "destructive",
        });
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result?.success) {
        toast({
          title: "Erro",
          description: result?.message || "Não foi possível redefinir a senha.",
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
          <form onSubmit={handleCheckEmail} className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-emerald-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Recuperar Senha</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Digite seu email cadastrado para receber o código de recuperação.
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
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          </form>
        );

      case "channel":
        return (
          <div className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <KeyRound className="h-8 w-8 text-emerald-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Como deseja receber?</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Escolha como deseja receber o código de recuperação.
              </p>
            </div>

            <div className="space-y-3">
              {patientHasEmail && (
                <Button
                  variant="outline"
                  className="w-full h-16 flex items-center gap-4 border-2 hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                  onClick={() => sendResetCode("email")}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  ) : (
                    <Mail className="h-6 w-6 text-emerald-600" />
                  )}
                  <div className="text-left">
                    <span className="text-sm font-medium block">Enviar por E-mail</span>
                    <span className="text-xs text-muted-foreground">{email}</span>
                  </div>
                </Button>
              )}

              {patientPhone && (
                <Button
                  variant="outline"
                  className="w-full h-16 flex items-center gap-4 border-2 hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                  onClick={() => sendResetCode("whatsapp")}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  ) : (
                    <MessageSquare className="h-6 w-6 text-emerald-600" />
                  )}
                  <div className="text-left">
                    <span className="text-sm font-medium block">Enviar por WhatsApp</span>
                    <span className="text-xs text-muted-foreground">{patientPhone}</span>
                  </div>
                </Button>
              )}
            </div>
          </div>
        );

      case "code":
        return (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <KeyRound className="h-8 w-8 text-emerald-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Digite o Código</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Enviamos um código de 6 dígitos para <strong>{email}</strong>
              </p>
            </div>

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => setCode(value)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={code.length !== 6}
            >
              Verificar Código
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-emerald-600 hover:underline"
                onClick={() => setStep("channel")}
                disabled={loading}
              >
                Reenviar código
              </button>
            </div>
          </form>
        );

      case "verify_identity":
        return (
          <form onSubmit={handleVerifyIdentity} className="space-y-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Verificação de Identidade</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Para sua segurança, informe seu <strong>ano de nascimento</strong> para continuar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthYear">Ano de Nascimento</Label>
              <Input
                id="birthYear"
                type="number"
                placeholder="Ex: 1985"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.slice(0, 4))}
                className="h-12 text-center text-lg tracking-widest"
                min="1900"
                max={new Date().getFullYear()}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={!birthYear || birthYear.length !== 4}
            >
              Verificar e Continuar
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              🔒 Este link é pessoal e intransferível. Não compartilhe.
            </p>
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
                if (step === "email") {
                  navigate("/app");
                } else if (step === "channel") {
                  setStep("email");
                } else if (step === "code") {
                  setStep("channel");
                } else if (step === "verify_identity") {
                  if (cameFromLink) {
                    navigate("/app");
                  } else {
                    setStep("code");
                  }
                } else if (step === "password") {
                  setStep("verify_identity");
                }
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
