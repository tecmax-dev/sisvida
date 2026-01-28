import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, ArrowLeft, Check, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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

// Função para formatar data (DD/MM/YYYY)
const formatDate = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
};

// Função para validar data
const isValidDate = (dateStr: string) => {
  const numbers = dateStr.replace(/\D/g, '');
  if (numbers.length !== 8) return false;
  
  const day = parseInt(numbers.slice(0, 2));
  const month = parseInt(numbers.slice(2, 4));
  const year = parseInt(numbers.slice(4, 8));
  
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  
  // Validação mais precisa
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
};

// Converter data DD/MM/YYYY para YYYY-MM-DD
const convertToISODate = (dateStr: string) => {
  const numbers = dateStr.replace(/\D/g, '');
  const day = numbers.slice(0, 2);
  const month = numbers.slice(2, 4);
  const year = numbers.slice(4, 8);
  return `${year}-${month}-${day}`;
};

type Step = 'cpf' | 'birthdate' | 'password' | 'success';

interface PatientData {
  id: string;
  name: string;
  birth_date: string;
}

export default function MobileFirstAccessPage() {
  const [step, setStep] = useState<Step>('cpf');
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    if (formatted.length <= 14) {
      setCpf(formatted);
    }
  };

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDate(e.target.value);
    if (formatted.length <= 10) {
      setBirthDate(formatted);
    }
  };

  const handleCheckCpf = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cpf) {
      toast({
        title: "CPF obrigatório",
        description: "Preencha seu CPF para continuar.",
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
      const normalizedCpf = cpf.replace(/\D/g, '');
      
      // Buscar paciente pelo CPF que não tenha senha cadastrada
      const { data: patients, error } = await supabase
        .from('patients')
        .select('id, name, birth_date, password_hash')
        .or(`cpf.eq.${normalizedCpf},cpf.eq.${cpf}`)
        .eq('is_active', true);

      if (error) throw error;

      if (!patients || patients.length === 0) {
        toast({
          title: "CPF não encontrado",
          description: "Este CPF não está cadastrado no sistema. Entre em contato com o sindicato.",
          variant: "destructive",
        });
        return;
      }

      const patient = patients[0];

      // Verificar se já tem senha cadastrada
      if (patient.password_hash) {
        toast({
          title: "Senha já cadastrada",
          description: "Você já possui uma senha. Use a opção 'Entrar' para acessar ou 'Esqueci minha senha' para recuperá-la.",
          variant: "destructive",
        });
        return;
      }

      // Verificar se tem data de nascimento cadastrada
      if (!patient.birth_date) {
        toast({
          title: "Dados incompletos",
          description: "Seu cadastro está incompleto. Entre em contato com o sindicato para atualizar seus dados.",
          variant: "destructive",
        });
        return;
      }

      setPatientData({
        id: patient.id,
        name: patient.name,
        birth_date: patient.birth_date
      });
      setStep('birthdate');
      
    } catch (err: any) {
      console.error("Error checking CPF:", err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao verificar o CPF. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBirthDate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!birthDate) {
      toast({
        title: "Data obrigatória",
        description: "Preencha sua data de nascimento para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidDate(birthDate)) {
      toast({
        title: "Data inválida",
        description: "Por favor, insira uma data válida no formato DD/MM/AAAA.",
        variant: "destructive",
      });
      return;
    }

    if (!patientData) {
      toast({
        title: "Erro",
        description: "Dados do paciente não encontrados. Volte e tente novamente.",
        variant: "destructive",
      });
      setStep('cpf');
      return;
    }

    setLoading(true);
    
    try {
      // Converter a data informada para formato ISO
      const inputDateISO = convertToISODate(birthDate);
      
      // Comparar com a data cadastrada (apenas a parte YYYY-MM-DD)
      const storedDate = patientData.birth_date.split('T')[0];
      
      if (inputDateISO !== storedDate) {
        toast({
          title: "Data incorreta",
          description: "A data de nascimento informada não confere com nossos registros.",
          variant: "destructive",
        });
        return;
      }

      // Data correta - avançar para criação de senha
      setStep('password');
      
    } catch (err: any) {
      console.error("Error verifying birth date:", err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao verificar a data. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

    if (!patientData) {
      toast({
        title: "Erro",
        description: "Dados do paciente não encontrados. Volte e tente novamente.",
        variant: "destructive",
      });
      setStep('cpf');
      return;
    }

    setLoading(true);
    
    try {
      // Usar RPC para definir a senha diretamente (já que validamos a data de nascimento)
      const { error } = await supabase.rpc('set_patient_password_direct' as any, {
        p_patient_id: patientData.id,
        p_password: password
      });

      if (error) throw error;

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

  const getFirstName = () => {
    if (!patientData?.name) return '';
    return patientData.name.split(' ')[0];
  };

  const renderStep = () => {
    switch (step) {
      case 'cpf':
        return (
          <form onSubmit={handleCheckCpf} className="space-y-6">
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
              <p className="text-xs text-muted-foreground">
                Informe o CPF cadastrado no sindicato
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
                  Verificando...
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          </form>
        );

      case 'birthdate':
        return (
          <form onSubmit={handleVerifyBirthDate} className="space-y-6">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">
                Olá, <strong className="text-foreground">{getFirstName()}</strong>! 👋
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Para sua segurança, confirme sua identidade
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate" className="text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data de Nascimento
              </Label>
              <Input
                id="birthDate"
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                value={birthDate}
                onChange={handleBirthDateChange}
                className="h-12 text-center text-lg tracking-wider"
                disabled={loading}
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground text-center">
                Informe sua data de nascimento para validar
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={loading || birthDate.replace(/\D/g, '').length !== 8}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                "Validar"
              )}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-emerald-600 hover:underline"
              onClick={() => {
                setStep('cpf');
                setBirthDate('');
                setPatientData(null);
              }}
            >
              Voltar
            </button>
          </form>
        );

      case 'password':
        return (
          <form onSubmit={handleSetPassword} className="space-y-6">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">
                Perfeito, <strong className="text-foreground">{getFirstName()}</strong>! ✅
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Agora crie sua senha de acesso
              </p>
            </div>

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
      case 'cpf':
        return 'Primeiro Acesso';
      case 'birthdate':
        return 'Validação';
      case 'password':
        return 'Criar Senha';
      case 'success':
        return 'Sucesso!';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'cpf':
        return 'Informe seu CPF para iniciar o cadastro de senha';
      case 'birthdate':
        return 'Confirme sua data de nascimento';
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
          onClick={() => {
            if (step === 'cpf') {
              navigate("/app");
            } else if (step === 'birthdate') {
              setStep('cpf');
              setBirthDate('');
              setPatientData(null);
            } else if (step === 'password') {
              setStep('birthdate');
              setPassword('');
              setConfirmPassword('');
            }
          }}
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
                {['cpf', 'birthdate', 'password'].map((s, i) => (
                  <div
                    key={s}
                    className={`h-2 w-8 rounded-full transition-colors ${
                      ['cpf', 'birthdate', 'password'].indexOf(step) >= i
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
