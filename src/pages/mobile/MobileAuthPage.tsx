import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function MobileAuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha e-mail e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Erro ao entrar",
          description: "E-mail ou senha incorretos.",
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Check if user is a patient (member)
        const { data: patientData, error: patientError } = await supabase
          .from("patients")
          .select("id, name, is_active, no_show_blocked_until, clinic_id")
          .eq("email", email)
          .maybeSingle();

        if (patientError || !patientData) {
          toast({
            title: "Acesso não autorizado",
            description: "Você não está cadastrado como sócio.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }

        if (!patientData.is_active) {
          toast({
            title: "Conta inativa",
            description: "Sua conta está inativa. Entre em contato com o sindicato.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }

        // Store patient info for the mobile app
        sessionStorage.setItem('mobile_patient_id', patientData.id);
        sessionStorage.setItem('mobile_clinic_id', patientData.clinic_id);
        
        navigate("/app/home");
      }
    } catch (err) {
      console.error("Login error:", err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao fazer login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col">
      {/* Header */}
      <div className="bg-emerald-600 text-white py-8 px-4 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
            <img 
              src="/logo-sindicato.png" 
              alt="SECMI" 
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.currentTarget.src = "/placeholder.svg";
              }}
            />
          </div>
        </div>
        <h1 className="text-2xl font-bold">SECMI</h1>
        <p className="text-sm opacity-90">SINDICATO DOS COMERCIÁRIOS</p>
      </div>

      {/* Login Card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 p-6">
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-4 pb-6">
            <h2 className="text-xl font-semibold text-center text-foreground">
              Acesse sua conta
            </h2>
          </CardHeader>
          <CardContent className="px-0">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">E-mail</Label>
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

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
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
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <a 
                href="#" 
                className="text-sm text-emerald-600 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  toast({
                    title: "Recuperar senha",
                    description: "Entre em contato com o sindicato para recuperar sua senha.",
                  });
                }}
              >
                Esqueci minha senha
              </a>
            </div>
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
