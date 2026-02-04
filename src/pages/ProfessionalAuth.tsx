import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ArrowLeft, Stethoscope } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

export default function ProfessionalAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  // PROTEÇÃO ANTI-LOOP: flags de execução
  const isAuthenticatingRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // PROTEÇÃO ANTI-LOOP: bloquear execução concorrente
    if (isAuthenticatingRef.current) {
      console.warn('[ProfessionalAuth] Login já em andamento, ignorando chamada duplicada');
      return;
    }
    
    // PROTEÇÃO ANTI-LOOP: evitar re-login após navegação
    if (hasNavigatedRef.current) {
      console.warn('[ProfessionalAuth] Navegação já realizada, ignorando');
      return;
    }
    
    if (!validateForm()) return;

    isAuthenticatingRef.current = true;
    setLoading(true);

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        isAuthenticatingRef.current = false;
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Credenciais inválidas",
            description: "Email ou senha incorretos.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      // Login bem-sucedido - redirect IMEDIATO sem queries adicionais
      // A página de destino verificará se é profissional ativo
      if (signInData.user) {
        hasNavigatedRef.current = true;
        navigate("/profissional/painel", { replace: true });
      }
    } catch (error: any) {
      isAuthenticatingRef.current = false;
      hasNavigatedRef.current = false;
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao site
          </Link>
          
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-medium text-foreground">Portal do Profissional</span>
          </div>
          
          <h2 className="mt-6 text-center text-2xl font-bold text-foreground">
            Acesse sua agenda
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Entre com suas credenciais para ver suas consultas
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className={`mt-1.5 ${errors.email ? "border-destructive" : ""}`}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            É administrador da clínica?{" "}
            <Link
              to="/auth"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Acesse o painel
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary via-primary/90 to-primary/70 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-center">
          <h3 className="text-3xl font-bold text-white">
            Sua agenda digital
          </h3>
          <p className="mt-4 text-lg text-white/90 max-w-md">
            Visualize seus pacientes do dia, inicie e finalize atendimentos 
            de forma simples e organizada.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-4 max-w-sm">
            {[
              { value: "📅", label: "Agenda do dia" },
              { value: "▶️", label: "Iniciar atendimento" },
              { value: "✅", label: "Finalizar consulta" },
              { value: "📋", label: "Prontuário integrado" },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20"
              >
                <div className="text-2xl">{stat.value}</div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
