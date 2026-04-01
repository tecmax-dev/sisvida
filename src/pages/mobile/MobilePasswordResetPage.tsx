import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, Lock, CheckCircle, ShieldCheck } from "lucide-react";

type Step = "email" | "verify_identity" | "password" | "success";

export default function MobilePasswordResetPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
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
      const { data, error } = await supabase.rpc("reset_patient_password_by_birth_year", {
        p_email: email,
        p_birth_year: parseInt(birthYear, 10),
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

      const result = typeof data === "object" ? data : null;

      if (!result?.success) {
        toast({
          title: "Erro",
          description: (result as any)?.message || "Não foi possível redefinir a senha.",
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
                Digite seu email cadastrado para iniciar a recuperação de senha.
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
              Continuar
            </Button>
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
              🔒 Seus dados são protegidos e não serão compartilhados.
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
                } else if (step === "verify_identity") {
                  setStep("email");
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
