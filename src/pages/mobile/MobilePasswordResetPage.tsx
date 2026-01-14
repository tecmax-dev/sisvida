import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, KeyRound, Lock, CheckCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "email" | "code" | "password" | "success";

export default function MobilePasswordResetPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSendCode = async (e: React.FormEvent) => {
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
      const { data, error } = await supabase.functions.invoke("send-password-reset-email", {
        body: { email }
      });

      if (error) throw error;

      toast({
        title: "Código enviado!",
        description: "Verifique seu email para obter o código de recuperação.",
      });
      
      setStep("code");
    } catch (err: any) {
      console.error("Error sending reset email:", err);

      // Supabase Functions can return non-2xx with a JSON body.
      // Try to extract a useful message for the user.
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

      // Guidance for the most common case in our flow
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
      const { data, error } = await supabase.rpc("reset_patient_password_with_token", {
        p_email: email,
        p_token: code,
        p_new_password: newPassword
      });

      if (error) throw error;

      const result = data?.[0];

      if (!result?.success) {
        toast({
          title: "Erro",
          description: result?.message || "Não foi possível redefinir a senha.",
          variant: "destructive",
        });
        return;
      }

      setStep("success");
    } catch (err) {
      console.error("Error resetting password:", err);
      toast({
        title: "Erro",
        description: "Não foi possível redefinir a senha. Tente novamente.",
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
          <form onSubmit={handleSendCode} className="space-y-6">
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
                  Enviando...
                </>
              ) : (
                "Enviar Código"
              )}
            </Button>
          </form>
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
                onClick={() => handleSendCode({ preventDefault: () => {} } as React.FormEvent)}
                disabled={loading}
              >
                {loading ? "Reenviando..." : "Reenviar código"}
              </button>
            </div>
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
                } else if (step === "code") {
                  setStep("email");
                } else if (step === "password") {
                  setStep("code");
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
          <p>© 2026 I & B Tecnologia</p>
          <p className="mt-1">Todos os Direitos Reservados</p>
        </div>
      </div>
    </div>
  );
}
