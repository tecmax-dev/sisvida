import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, ArrowLeft, Check } from "lucide-react";

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
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(numbers[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(numbers[10])) return false;
  
  return true;
};

type Step = 'cpf_email' | 'code' | 'password' | 'success';

export default function MobileFirstAccessPage() {
  const [step, setStep] = useState<Step>('cpf_email');
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    if (formatted.length <= 14) {
      setCpf(formatted);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cpf || !email) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha CPF e email para continuar.",
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

    if (!email.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-first-access-email', {
        body: { cpf: cpf.replace(/\D/g, ''), email: email.toLowerCase().trim() }
      });

      if (error) throw error;

      toast({
        title: "Código enviado!",
        description: "Verifique seu email e insira o código de 6 dígitos.",
      });
      setStep('code');
    } catch (err: any) {
      console.error("Error sending code:", err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao enviar o código. Tente novamente.",
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
        title: "Código inválido",
        description: "O código deve ter 6 dígitos.",
        variant: "destructive",
      });
      return;
    }

    // Avança para a etapa de senha (a validação final será no submit)
    setStep('password');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A senha e a confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('complete_first_access', {
        p_token: code,
        p_email: email.toLowerCase().trim(),
        p_password: password
      });

      if (error) throw error;

      if (!data) {
        toast({
          title: "Código inválido ou expirado",
          description: "O código informado é inválido ou já expirou. Solicite um novo código.",
          variant: "destructive",
        });
        setStep('cpf_email');
        setCode('');
        return;
      }

      setStep('success');
    } catch (err: any) {
      console.error("Error setting password:", err);
      toast({
        title: "Erro",
        description: err.message || "Ocorreu um erro ao cadastrar a senha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'cpf_email':
        return (
          <form onSubmit={handleSendCode} className="space-y-6">
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
              <Label htmlFor="email" className="text-foreground">Email cadastrado</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Use o mesmo email cadastrado no sindicato
              </p>
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
                "Enviar código"
              )}
            </Button>
          </form>
        );

      case 'code':
        return (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground">
                Enviamos um código de 6 dígitos para<br />
                <strong className="text-foreground">{email}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-foreground">Código de verificação</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-14 text-center text-2xl tracking-widest font-mono"
                disabled={loading}
                maxLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={loading || code.length !== 6}
            >
              Verificar código
            </Button>

            <button
              type="button"
              className="w-full text-sm text-emerald-600 hover:underline"
              onClick={() => {
                setStep('cpf_email');
                setCode('');
              }}
            >
              Voltar e reenviar código
            </button>
          </form>
        );

      case 'password':
        return (
          <form onSubmit={handleSetPassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Nova senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Confirmar senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 pr-12"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                  Cadastrando...
                </>
              ) : (
                "Cadastrar senha"
              )}
            </Button>
          </form>
        );

      case 'success':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-emerald-600" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Senha cadastrada!
              </h3>
              <p className="text-muted-foreground">
                Sua senha foi cadastrada com sucesso. Agora você pode acessar o aplicativo.
              </p>
            </div>

            <Button
              onClick={() => navigate("/app")}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Ir para login
            </Button>
          </div>
        );
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'cpf_email':
        return 'Primeiro Acesso';
      case 'code':
        return 'Verificação';
      case 'password':
        return 'Criar Senha';
      case 'success':
        return 'Sucesso!';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'cpf_email':
        return 'Informe seu CPF e email cadastrados para receber o código de verificação';
      case 'code':
        return 'Digite o código que enviamos para seu email';
      case 'password':
        return 'Crie uma senha segura para acessar o aplicativo';
      case 'success':
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col">
      {/* Header */}
      <div className="bg-emerald-600 text-white py-6 px-4">
        <button
          onClick={() => step === 'cpf_email' ? navigate("/app") : setStep('cpf_email')}
          className="flex items-center text-white/90 hover:text-white mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Voltar
        </button>
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
              <img 
                src="/logo-sindicato.png" 
                alt="SECMI" 
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
              />
            </div>
          </div>
          <h1 className="text-xl font-bold">SECMI</h1>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-2 p-6">
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-4 pb-6">
            <h2 className="text-xl font-semibold text-center text-foreground">
              {getStepTitle()}
            </h2>
            {getStepDescription() && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                {getStepDescription()}
              </p>
            )}
            
            {/* Progress indicator */}
            {step !== 'success' && (
              <div className="flex justify-center gap-2 mt-4">
                {['cpf_email', 'code', 'password'].map((s, i) => (
                  <div
                    key={s}
                    className={`h-2 w-8 rounded-full transition-colors ${
                      ['cpf_email', 'code', 'password'].indexOf(step) >= i
                        ? 'bg-emerald-600'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="px-0">
            {renderStep()}
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
