import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export default function MobileChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Password validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast({
        title: "Senha fraca",
        description: "A senha não atende aos requisitos mínimos de segurança.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha não corresponde à nova senha.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const patientId = localStorage.getItem("mobile_patient_id");

      if (!patientId) {
        navigate("/app/login");
        return;
      }

      // Fetch patient CPF first
      const { data: patientData } = await supabase
        .from("patients")
        .select("cpf")
        .eq("id", patientId)
        .single();

      if (!patientData?.cpf) {
        toast({
          title: "Erro",
          description: "CPF não encontrado.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Verify current password
      const { data: verifyData, error: verifyError } = await supabase.rpc(
        "verify_patient_password",
        {
          p_cpf: patientData.cpf,
          p_password: currentPassword,
        }
      );

      if (verifyError || !verifyData) {
        toast({
          title: "Senha atual incorreta",
          description: "A senha atual informada está incorreta.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.rpc("set_patient_password", {
        p_patient_id: patientId,
        p_password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua senha foi atualizada. Use a nova senha no próximo acesso.",
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate("/app/home");
      }, 2000);
    } catch (err) {
      console.error("Error changing password:", err);
      toast({
        title: "Erro ao alterar senha",
        description: "Ocorreu um erro ao alterar sua senha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Senha alterada!</h1>
          <p className="text-muted-foreground">
            Sua senha foi atualizada com sucesso. Redirecionando...
          </p>
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate("/app/home")} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Alterar Senha</h1>
          <p className="text-xs text-white/80">Mantenha sua conta segura</p>
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <Lock className="h-5 w-5" />
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Security Info */}
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 text-sm mb-1">Segurança da conta</h4>
                <p className="text-xs text-blue-700">
                  Escolha uma senha forte que você não use em outros sites. A senha deve ter no
                  mínimo 8 caracteres.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Password */}
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Senha atual</Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="newPassword">Nova senha</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Password Requirements */}
          {newPassword.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Requisitos da senha:</p>
              <div className="grid grid-cols-2 gap-2">
                <PasswordRule valid={hasMinLength} text="Mínimo 8 caracteres" />
                <PasswordRule valid={hasUppercase} text="Uma letra maiúscula" />
                <PasswordRule valid={hasLowercase} text="Uma letra minúscula" />
                <PasswordRule valid={hasNumber} text="Um número" />
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova senha"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {confirmPassword.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {passwordsMatch ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-emerald-600">Senhas conferem</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-500">Senhas não conferem</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Warning */}
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Após alterar sua senha, você precisará usar a nova senha para acessar o aplicativo.
                Certifique-se de memorizá-la ou guardá-la em local seguro.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
          disabled={loading || !isPasswordValid || !passwordsMatch || !currentPassword}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Alterando senha...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Alterar Senha
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

function PasswordRule({ valid, text }: { valid: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {valid ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-gray-300" />
      )}
      <span className={`text-xs ${valid ? "text-emerald-600" : "text-muted-foreground"}`}>
        {text}
      </span>
    </div>
  );
}
