import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, KeyRound } from "lucide-react";
import { z } from "zod";
import ReCAPTCHA from "react-google-recaptcha";
import dashboardMockup from "@/assets/dashboard-mockup.png";

const RECAPTCHA_SITE_KEY = "6Ldo7j0sAAAAAIekvXAZmH_AmwixcFhuwBWAR38N";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

type AuthView = "login" | "signup" | "forgot-password" | "reset-password" | "first-access";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<AuthView>(
    searchParams.get("tab") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fromExpiredLink, setFromExpiredLink] = useState(false);
  const [isFirstAccess, setIsFirstAccess] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  // useRef para controlar o fluxo de primeiro acesso - atualizado imediatamente sem re-render
  const isFirstAccessFlowRef = useRef(false);
  const [errors, setErrors] = useState<{ 
    email?: string; 
    password?: string; 
    confirmPassword?: string;
    name?: string;
    recaptcha?: string;
  }>({});
  
  // useRef para controlar o fluxo de recuperação - atualizado imediatamente sem re-render
  const isRecoveryFlowRef = useRef(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Verificar URL hash IMEDIATAMENTE na inicialização - antes de qualquer coisa
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    const accessToken = hashParams.get("access_token");
    
    // Se for recovery flow, marcar ref IMEDIATAMENTE
    if (type === "recovery" && accessToken) {
      isRecoveryFlowRef.current = true;
      setView("reset-password");
    }
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Check for errors in URL (expired/invalid link)
    const error = hashParams.get("error");
    const errorCode = hashParams.get("error_code");
    
    if (error === "access_denied") {
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);
      isRecoveryFlowRef.current = false;
      
      if (errorCode === "otp_expired") {
        toast({
          title: "Link expirado",
          description: "O link de recuperação expirou ou já foi usado. Solicite um novo link.",
          variant: "destructive",
        });
        setFromExpiredLink(true);
        setView("forgot-password");
      } else {
        toast({
          title: "Link inválido",
          description: "O link de recuperação é inválido. Solicite um novo link.",
          variant: "destructive",
        });
        setFromExpiredLink(true);
        setView("forgot-password");
      }
      return;
    }
  }, [toast]);

  useEffect(() => {
    const checkUserAndRedirect = async (userId: string) => {
      // Verificar refs antes de redirecionar
      if (isRecoveryFlowRef.current || isFirstAccessFlowRef.current) return;
      
      // Verificar se é super admin
      const { data: superAdminData } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      // Verificar refs novamente após a query assíncrona
      if (isRecoveryFlowRef.current || isFirstAccessFlowRef.current) return;
      
      if (superAdminData) {
        navigate("/admin");
        return;
      }
      
      // Verificar se usuário tem roles/clínica
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('clinic_id')
        .eq('user_id', userId)
        .limit(1);
      
      // Verificar refs novamente
      if (isRecoveryFlowRef.current || isFirstAccessFlowRef.current) return;
      
      // Se tem pelo menos uma clínica, vai para dashboard
      if (rolesData && rolesData.length > 0) {
        navigate("/dashboard");
      } else {
        // Sem clínica, vai para setup
        navigate("/clinic-setup");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // PASSWORD_RECOVERY - marcar ref e não redirecionar
      if (event === "PASSWORD_RECOVERY") {
        isRecoveryFlowRef.current = true;
        setView("reset-password");
        return;
      }
      
      // Verificar refs (síncrono e confiável)
      if (isRecoveryFlowRef.current || isFirstAccessFlowRef.current) return;
      
      // Verificar URL hash como fallback
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const isRecoveryInHash = hashParams.get("type") === "recovery" || 
                               window.location.hash.includes("type=recovery");
      
      if (isRecoveryInHash) {
        isRecoveryFlowRef.current = true;
        return;
      }
      
      if (session?.user) {
        setTimeout(() => {
          // Verificar refs novamente antes de redirecionar
          if (!isRecoveryFlowRef.current && !isFirstAccessFlowRef.current) {
            checkUserAndRedirect(session.user.id);
          }
        }, 0);
      }
    });

    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Verificar refs ANTES de redirecionar
      if (isRecoveryFlowRef.current || isFirstAccessFlowRef.current) return;
      
      // Verificar URL hash como dupla checagem
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      if (hashParams.get("type") === "recovery") {
        isRecoveryFlowRef.current = true;
        return;
      }
      
      if (session?.user) {
        checkUserAndRedirect(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]); // Removido isResettingPassword das dependências!

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    if (view !== "reset-password" && view !== "first-access") {
      try {
        emailSchema.parse(email);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.email = e.errors[0].message;
        }
      }
    }

    if (view === "login" || view === "reset-password" || view === "first-access") {
      try {
        passwordSchema.parse(password);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.password = e.errors[0].message;
        }
      }
    }

    if (view === "reset-password" || view === "first-access") {
      if (password !== confirmPassword) {
        newErrors.confirmPassword = "As senhas não coincidem";
      }
    }

    if (view === "signup" && !name.trim()) {
      newErrors.name = "Nome é obrigatório";
    }

    // Validar reCAPTCHA para login e signup
    if ((view === "login" || view === "signup") && !recaptchaToken) {
      newErrors.recaptcha = "Complete o reCAPTCHA";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const verifyRecaptcha = async (token: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-recaptcha", {
        body: { token },
      });
      
      if (error) {
        console.error("Erro ao verificar reCAPTCHA:", error);
        return false;
      }
      
      return data?.success === true;
    } catch (err) {
      console.error("Erro ao verificar reCAPTCHA:", err);
      return false;
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors({ email: error.errors[0].message });
        return;
      }
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/auth`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      
      setEmail("");
      setView("login");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: "Senha alterada com sucesso!",
        description: "Você já pode fazer login com sua nova senha.",
      });
      
      // Clear the hash from URL and reset ref
      window.history.replaceState(null, '', window.location.pathname);
      isRecoveryFlowRef.current = false;
      
      setPassword("");
      setConfirmPassword("");
      setView("login");
    } catch (error: any) {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Verificar reCAPTCHA no servidor para login e signup
      if ((view === "login" || view === "signup") && recaptchaToken) {
        const isValid = await verifyRecaptcha(recaptchaToken);
        if (!isValid) {
          toast({
            title: "Verificação falhou",
            description: "O reCAPTCHA não pôde ser verificado. Tente novamente.",
            variant: "destructive",
          });
          recaptchaRef.current?.reset();
          setRecaptchaToken(null);
          setLoading(false);
          return;
        }
      }

      if (view === "login") {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Credenciais inválidas",
              description: "Email ou senha incorretos. Verifique e tente novamente.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          setLoading(false);
          return;
        }

        // Após login bem-sucedido, verificar se é primeiro acesso
        if (signInData.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', signInData.user.id)
            .single();

          // Se password_changed é false ou null, é primeiro acesso
          if (!(profileData as any)?.password_changed) {
            isFirstAccessFlowRef.current = true; // Bloquear redirecionamento
            setIsFirstAccess(true);
            setView("first-access");
            setPassword("");
            setConfirmPassword("");
            setLoading(false);
            return;
          }
        }
      } else if (view === "first-access") {
        // Criar nova senha pessoal
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
        });

        if (updateError) throw updateError;

        // Marcar que a senha foi alterada
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await supabase
            .from('profiles')
            .update({ password_changed: true } as any)
            .eq('user_id', userData.user.id);
        }

        toast({
          title: "Senha criada com sucesso!",
          description: "Sua senha pessoal foi definida.",
        });

        isFirstAccessFlowRef.current = false; // Liberar redirecionamento
        setIsFirstAccess(false);
        
        // Redirecionar para a área correta
        if (userData.user) {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('clinic_id')
            .eq('user_id', userData.user.id)
            .limit(1);

          if (rolesData && rolesData.length > 0) {
            navigate("/dashboard");
          } else {
            navigate("/clinic-setup");
          }
        }
        return;
      } else if (view === "signup") {
        // Gerar senha temporária
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
        let tempPassword = "";
        for (let i = 0; i < 12; i++) {
          tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        tempPassword += "Aa1!";
        
        const { data, error } = await supabase.auth.signUp({
          email,
          password: tempPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: name,
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Email já cadastrado",
              description: "Este email já está em uso. Tente fazer login ou use outro email.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          return;
        }

        if (data.user) {
          // Enviar credenciais por email
          try {
            const { error: credentialsError } = await supabase.functions.invoke(
              "send-user-credentials",
              {
                body: {
                  userEmail: email,
                  userName: name,
                  tempPassword: tempPassword,
                  clinicName: "",
                },
              }
            );

            if (credentialsError) {
              throw credentialsError;
            }
          } catch (emailError) {
            console.error("Erro ao enviar credenciais:", emailError);
            toast({
              title: "Conta criada, mas email não enviado",
              description:
                "Não foi possível enviar sua senha temporária. Tente novamente.",
              variant: "destructive",
            });
          }

          // Fazer logout para que o usuário faça login com as credenciais recebidas
          await supabase.auth.signOut();

          toast({
            title: "Conta criada com sucesso!",
            description: "Suas credenciais foram enviadas para seu email.",
          });

          // Voltar para a tela de login
          switchView("login");
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const switchView = (newView: AuthView) => {
    setView(newView);
    setErrors({});
    setPassword("");
    setConfirmPassword("");
    setFromExpiredLink(false);
  };

  const getTitle = () => {
    switch (view) {
      case "login": return "Bem-vindo de volta";
      case "signup": return "Crie sua conta";
      case "forgot-password": return "Esqueceu a senha?";
      case "reset-password": return "Redefinir senha";
      case "first-access": return "Crie sua senha pessoal";
    }
  };

  const getSubtitle = () => {
    switch (view) {
      case "login": return "Entre para acessar sua clínica";
      case "signup": return "Comece a gerenciar sua clínica hoje";
      case "forgot-password": return "Digite seu email para receber o link de recuperação";
      case "reset-password": return "Digite sua nova senha";
      case "first-access": return "Para sua segurança, crie uma senha pessoal";
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0d1117]">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Elemento decorativo esquerdo - forma abstrata */}
        <div className="absolute left-0 top-0 w-[400px] h-full">
          <svg viewBox="0 0 400 900" className="h-full w-full" preserveAspectRatio="none">
            <path
              d="M0 0 L200 0 L200 300 Q300 450 200 600 L200 900 L0 900 Z"
              fill="hsl(var(--primary))"
              opacity="0.15"
            />
          </svg>
        </div>
        
        {/* Círculos decorativos */}
        <div className="absolute top-10 right-20 w-32 h-32 rounded-full bg-primary/5 blur-xl" />
        <div className="absolute bottom-20 left-40 w-24 h-24 rounded-full bg-primary/10 blur-lg" />
        <div className="absolute top-1/3 right-1/4 w-16 h-16 rounded-full bg-primary/5 blur-md" />
        
        {/* Elementos sparkle */}
        <div className="absolute top-20 right-40 text-primary/40 text-4xl animate-pulse">✦</div>
        <div className="absolute bottom-32 right-60 text-primary/30 text-2xl animate-pulse delay-300">✧</div>
        <div className="absolute top-1/2 right-20 text-primary/20 text-3xl animate-pulse delay-500">✦</div>
      </div>

      {/* Título decorativo "Feliz 2026" estilo */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="relative">
          <span className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
            ✨ Bem-vindo ao Eclini ✨
          </span>
        </div>
      </div>

      {/* Container principal */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-5xl bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
          
          {/* Painel esquerdo - Formulário */}
          <div className="flex-1 p-8 lg:p-12">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao site
            </Link>
            
            <div className="mb-8">
              <Logo size="lg" />
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-1">
              {getTitle()}
            </h2>
            <p className="text-muted-foreground mb-8">
              {getSubtitle()}
            </p>

            {/* Forgot Password Form */}
            {view === "forgot-password" && (
              <form className="space-y-5" onSubmit={handleForgotPassword}>
                {fromExpiredLink && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                    O link anterior expirou ou já foi utilizado. Solicite um novo link abaixo.
                  </div>
                )}
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Digite seu e-mail"
                      className={`pl-10 h-12 ${errors.email ? "border-destructive" : ""}`}
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar link de recuperação
                </Button>

                <button
                  type="button"
                  onClick={() => switchView("login")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="inline-block w-4 h-4 mr-1" />
                  Voltar para o login
                </button>
              </form>
            )}

            {/* Reset Password Form */}
            {view === "reset-password" && (
              <form className="space-y-5" onSubmit={handleResetPassword}>
                <div>
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Informe sua senha"
                      className={`pl-10 pr-10 h-12 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme sua senha"
                      className={`pl-10 pr-10 h-12 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Redefinir senha
                </Button>
              </form>
            )}

            {/* First Access Form */}
            {view === "first-access" && (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm">
                  <p className="font-medium mb-1 text-primary">🔐 Primeiro acesso detectado</p>
                  <p className="text-muted-foreground">
                    Você está usando uma senha temporária. Por segurança, crie uma senha pessoal agora.
                  </p>
                </div>

                <div>
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Informe sua senha"
                      className={`pl-10 pr-10 h-12 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme sua senha"
                      className={`pl-10 pr-10 h-12 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar minha senha
                </Button>
              </form>
            )}

            {/* Login/Signup Form */}
            {(view === "login" || view === "signup") && (
              <>
                <form className="space-y-5" onSubmit={handleSubmit}>
                  {view === "signup" && (
                    <div>
                      <Label htmlFor="name">Nome completo</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className={`mt-1.5 h-12 ${errors.name ? "border-destructive" : ""}`}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-destructive">{errors.name}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Digite seu e-mail"
                        className={`pl-10 h-12 ${errors.email ? "border-destructive" : ""}`}
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  {view === "login" && (
                    <div>
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Informe sua senha"
                          className={`pl-10 pr-10 h-12 ${errors.password ? "border-destructive" : ""}`}
                        />
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1 text-sm text-destructive">{errors.password}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => switchView("forgot-password")}
                        className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Esqueci a senha
                      </button>
                    </div>
                  )}

                  {/* reCAPTCHA */}
                  <div className="flex flex-col items-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      onChange={(token) => setRecaptchaToken(token)}
                      onExpired={() => setRecaptchaToken(null)}
                      onErrored={() => setRecaptchaToken(null)}
                    />
                    {errors.recaptcha && (
                      <p className="mt-1 text-sm text-destructive">{errors.recaptcha}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-12 text-base gap-2" disabled={loading || !recaptchaToken}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {view === "login" ? "Entrar" : "Criar conta"}
                    {!loading && <ArrowLeft className="h-4 w-4 rotate-180" />}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {view === "login" ? "Você ainda não tem conta Eclini?" : "Já tem uma conta?"}{" "}
                  <button
                    type="button"
                    onClick={() => switchView(view === "login" ? "signup" : "login")}
                    className="font-medium text-primary hover:underline transition-colors"
                  >
                    {view === "login" ? "Crie sua conta teste grátis aqui!" : "Fazer login"}
                  </button>
                </p>
              </>
            )}
          </div>
          
          {/* Painel direito - Promocional */}
          <div className="hidden lg:flex lg:w-[420px] bg-gradient-to-br from-primary via-primary to-primary-dark relative overflow-hidden p-8">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-40 h-40 border-2 border-white rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 border-2 border-white rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>
            
            {/* Conteúdo */}
            <div className="relative z-10 flex flex-col h-full">
              {/* Mockup do dashboard */}
              <div className="relative mb-6">
                <img 
                  src={dashboardMockup}
                  alt="Sistema Eclini"
                  className="rounded-xl shadow-2xl border-2 border-white/20"
                />
                {/* Brilho */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none" />
              </div>
              
              {/* Card informativo */}
              <div className="bg-white rounded-xl p-5 shadow-xl flex-1">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs text-muted-foreground">•••</span>
                </div>
                
                <p className="text-sm text-muted-foreground mb-1">
                  Clínicas orientadas por dados
                </p>
                <h3 className="text-2xl font-bold text-primary mb-4">
                  crescem <span className="text-3xl">30%</span> mais!
                </h3>
                
                <p className="text-sm text-muted-foreground mb-3">
                  Com o <strong>Módulo de Indicadores</strong>, você pode ver em tempo real:
                </p>
                
                <ul className="space-y-1.5 text-sm text-foreground mb-4">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Ocupação da agenda
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Cancelamentos e inadimplência
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Ticket médio e contas a receber
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Despesas e projeção financeira
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Perfil dos pacientes
                  </li>
                </ul>
                
                <p className="text-xs text-muted-foreground mb-4">
                  Transforme dados da rotina em <strong>clareza para decidir melhor</strong> e crescer com estrutura.
                </p>
                
                <Button size="sm" className="w-full gap-2" asChild>
                  <Link to="/cadastro">
                    Quero saber mais
                    <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
