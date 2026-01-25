import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Building2 } from "lucide-react";
import { useDynamicPWA } from "@/hooks/useDynamicPWA";
import { useMobileAuth } from "@/contexts/MobileAuthContext";

// Função para formatar CPF
const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
};

// Função para validar CPF
const isValidCPF = (cpf: string) => {
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(numbers[9])) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(numbers[10])) return false;
  
  return true;
};

// Target clinic for this mobile app
const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

/**
 * TELA DE LOGIN - APENAS FORMULÁRIO
 * 
 * Esta tela NÃO deve:
 * - Verificar sessão
 * - Redirecionar automaticamente
 * - Fazer login automático
 * 
 * Se o usuário chegar aqui com sessão válida, 
 * é porque a SplashScreen decidiu assim (não deveria acontecer).
 */
export default function MobileAuthPage() {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clinicData, setClinicData] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Hook de autenticação - usado APENAS para login manual
  const { login: authLogin } = useMobileAuth();
  
  // Apply PWA branding for the clinic
  useDynamicPWA();

  // Load clinic data for branding (visual apenas)
  useEffect(() => {
    const loadClinicData = async () => {
      const { data } = await supabase
        .from("clinics")
        .select("name, logo_url")
        .eq("id", TARGET_CLINIC_ID)
        .single();
      
      if (data) {
        setClinicData(data);
      }
    };
    loadClinicData();
  }, []);

  // REMOVIDO: Não há mais verificação de sessão ou redirect automático

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    if (formatted.length <= 14) {
      setCpf(formatted);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cpf || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha CPF e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidCPF(cpf)) {
      toast({
        title: "CPF inválido",
        description: "Por favor, insira um CPF válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Usar o hook de autenticação que cria sessão JWT
      const result = await authLogin(cpf, password);
      
      if (!result.success) {
        toast({
          title: "Credenciais inválidas",
          description: result.error || "CPF ou senha incorretos.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Bem-vindo!",
        description: `Olá, ${result.patientName?.split(' ')[0]}!`,
      });
      
      navigate("/app/home", { replace: true });
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
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center overflow-hidden">
            {clinicData?.logo_url && !logoError ? (
              <img 
                src={clinicData.logo_url} 
                alt={clinicData.name || "Logo"} 
                className="w-16 h-16 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Building2 className="w-10 h-10 text-emerald-600" />
            )}
          </div>
        </div>
        <h1 className="text-2xl font-bold">{clinicData?.name || "Carregando..."}</h1>
      </div>

      {/* Login Card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 p-6">
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-4 pb-6">
            <h2 className="text-xl font-semibold text-center text-foreground">
              Acesse sua conta
            </h2>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Use seu CPF e senha cadastrados
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-foreground">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
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
              <button
                type="button"
                className="text-sm text-emerald-600 hover:underline"
                onClick={() => navigate("/app/recuperar-senha")}
              >
                Esqueci minha senha
              </button>
            </div>

            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <p className="text-sm text-emerald-800 dark:text-emerald-200 text-center">
                <strong>Primeiro acesso?</strong>
              </p>
              <button
                type="button"
                className="w-full mt-2 text-sm text-emerald-700 dark:text-emerald-300 font-medium hover:underline"
                onClick={() => navigate("/app/primeiro-acesso")}
              >
                Clique aqui para cadastrar sua senha
              </button>
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
