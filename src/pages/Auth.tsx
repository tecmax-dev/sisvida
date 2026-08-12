

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, KeyRound, Shield, CalendarCheck, Users, BarChart3, CheckCircle, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { z } from "zod";
import { authTrace, maskEmail } from "@/lib/authTrace";

const getAppBaseUrl = () => {
  if (typeof window === "undefined") return "";
  return window.location.origin;
};

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

type AuthView = "login" | "signup" | "forgot-password" | "reset-password" | "first-access";

const PUBLISHED_FALLBACK_HOST = "sisvida.lovable.app";
const CANONICAL_CUSTOM_DOMAIN = "https://prosinge.com.br";

export default function Auth() {
  if (typeof window !== "undefined") {
    const isOnPublishedFallback = window.location.hostname === PUBLISHED_FALLBACK_HOST;
    const isAuthRoute = window.location.pathname.startsWith("/auth");
    const url = new URL(window.location.href);
    const isOAuthCallback = url.searchParams.has("code") || url.searchParams.has("error") || !!window.location.hash;

    if (isOnPublishedFallback && isAuthRoute && !isOAuthCallback) {
      window.location.replace(
        `${CANONICAL_CUSTOM_DOMAIN}${window.location.pathname}${window.location.search}${window.location.hash}`
      );
      return null;
    }
  }

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

  const isFirstAccessFlowRef = useRef(false);
  const isAuthenticatingRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  
  const [errors, setErrors] = useState<{ 
    email?: string; 
    password?: string; 
    confirmPassword?: string;
    name?: string;
  }>({});

  const isRecoveryFlowRef = useRef(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    const accessToken = hashParams.get("access_token");
    
    if (type === "recovery" && accessToken) {
      isRecoveryFlowRef.current = true;
      setView("reset-password");
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.substring(1));

    const errorInHash = hashParams.get("error");
    const errorInQuery = url.searchParams.get("error");
    const error = errorInHash ?? errorInQuery;

    const errorCode = hashParams.get("error_code") ?? url.searchParams.get("error_code");
    const errorDescription =
      hashParams.get("error_description") ?? url.searchParams.get("error_description");
    const typeInHash = hashParams.get("type");
    const typeInQuery = url.searchParams.get("type");
    const type = typeInHash ?? typeInQuery;

    if (!error) return;

    const hashForLog = url.hash.includes("access_token") ? "#[redacted]" : url.hash;
    console.info("[Auth] Callback error detected", {
      hostname: window.location.hostname,
      path: window.location.pathname,
      error,
      errorCode,
      errorDescription,
      type,
      errorSource: errorInHash ? "hash" : "query",
      typeSource: typeInHash ? "hash" : typeInQuery ? "query" : null,
      search: url.search,
      hash: hashForLog,
    });

    const clearAuthErrorFromUrl = () => {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.hash = "";
      ["error", "error_code", "error_description", "type"].forEach((k) => cleanUrl.searchParams.delete(k));
      window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}`);
    };

    if (error === "access_denied" && type === "recovery") {
      clearAuthErrorFromUrl();
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

    clearAuthErrorFromUrl();
    let description =
      "Não foi possível autenticar. Verifique as configurações do provedor e tente novamente.";
    if (errorDescription) {
      try {
        description = decodeURIComponent(errorDescription);
      } catch {
        description = errorDescription;
      }
    }

    toast({
      title: "Erro de autenticação",
      description,
      variant: "destructive",
    });
    setView("login");
  }, [toast]);

  useEffect(() => {
    let mounted = true;

    const redirectIfSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user && !isRecoveryFlowRef.current && !hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          authTrace("Auth.oauth.sessionDetected");
          navigate("/dashboard", { replace: true });
        }
      } catch {
        // silencioso
      }
    };

    redirectIfSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (!session?.user) return;
      if (isRecoveryFlowRef.current) return;
      if (hasNavigatedRef.current) return;

      if (event === "SIGNED_IN") {
        hasNavigatedRef.current = true;
        authTrace("Auth.oauth.signedIn");
        navigate("/dashboard", { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      const redirectUrl = `${getAppBaseUrl()}/auth`;
      
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

    authTrace("Auth.submit", {
      view,
      email: email ? maskEmail(email) : "[empty]",
    });
    
    if (isAuthenticatingRef.current) {
      console.warn('[Auth] Login já em andamento, ignorando chamada duplicada');
      authTrace("Auth.blocked.concurrent");
      return;
    }
    
    if (hasNavigatedRef.current) {
      console.warn('[Auth] Navegação já realizada, ignorando');
      authTrace("Auth.blocked.afterNavigate");
      return;
    }
    
    if (!validateForm()) return;

    isAuthenticatingRef.current = true;
    setLoading(true);

    try {
      if (view === "login") {
        authTrace("Auth.signIn.start");
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        authTrace("Auth.signIn.return", {
          ok: !error,
          hasUser: !!signInData?.user,
          error: error?.message ?? null,
        });
        
        if (error) {
          isAuthenticatingRef.current = false;
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

        if (signInData.user) {
          hasNavigatedRef.current = true;
          authTrace("Auth.navigate", { to: "/dashboard" });
          navigate("/dashboard", { replace: true });
        }
        
        return;
      } else if (view === "signup") {
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
            emailRedirectTo: `${getAppBaseUrl()}/`,
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
          await supabase.auth.signOut();

          toast({
            title: "Conta criada com sucesso!",
            description: "Verifique seu email para confirmar a conta e definir sua senha.",
          });

          switchView("login");
        }
      }
    } catch (error: any) {
      authTrace("Auth.exception", { message: error?.message ?? "unknown" });
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      isAuthenticatingRef.current = false;
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const isPreviewEnvironment =
        window.location.hostname.includes("lovable.app") ||
        window.location.hostname.includes("lovableproject.com");

      if (isPreviewEnvironment) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth`,
            skipBrowserRedirect: true,
            queryParams: {
              prompt: 'select_account',
            },
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth`,
            queryParams: {
              prompt: 'select_account',
            },
          },
        });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({
        title: "Erro ao entrar com Google",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
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
      case "login": return "Entre para acessar sua plataforma";
      case "signup": return "Comece a gerenciar agora";
      case "forgot-password": return "Digite seu email para receber o link de recuperação";
      case "reset-password": return "Digite sua nova senha";
      case "first-access": return "Por segurança, crie uma senha pessoal";
    }
  };

  const features = [
    { icon: CalendarCheck, title: "Agenda Inteligente", desc: "Agendamento online com confirmação automática" },
    { icon: Users, title: "Gestão de Associados", desc: "Controle completo de membros e dependentes" },
    { icon: BarChart3, title: "Indicadores em Tempo Real", desc: "Decisões estratégicas baseadas em dados" },
    { icon: Shield, title: "Segurança Total", desc: "Dados protegidos com criptografia avançada" },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Painel esquerdo - Branding (azul royal premium) */}
      <div 
        className="hidden lg:flex lg:w-[480px] xl:w-[520px] relative overflow-hidden flex-col justify-between p-10 xl:p-12"
        style={{ background: 'linear-gradient(135deg, hsl(220 80% 45%) 0%, hsl(220 80% 40%) 100%)' }}
      >
        {/* Padrão geométrico decorativo com gradiente */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.08]">
          <div className="absolute -top-20 -left-20 w-72 h-72 border-[3px] border-white rounded-full blur-sm" />
          <div className="absolute top-1/3 -right-16 w-56 h-56 border-[3px] border-white rounded-full blur-sm" />
          <div className="absolute -bottom-12 left-1/4 w-40 h-40 border-[2px] border-white rounded-full blur-sm" />
          <div className="absolute top-20 left-1/2 w-20 h-20 border-[2px] border-white rounded-full blur-sm" />
        </div>

        {/* Efeito de luz de fundo */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)'
        }} />

        <div className="relative z-10">
          <Logo size="lg" variant="light" customSrc={undefined} />
          <h1 className="text-3xl xl:text-4xl font-bold text-white mt-8 leading-tight">
            Gerencie sua entidade com eficiência total.
          </h1>
          <p className="text-white/75 mt-4 text-base leading-relaxed">
            Plataforma completa para sindicatos, associações e clínicas. Tudo em um só lugar.
          </p>
        </div>

        {/* Features grid com ícones melhorados */}
        <div className="relative z-10 space-y-4 mt-12">
          {features.map((feature, i) => (
            <div key={i} className="flex items-start gap-4 group cursor-pointer transition-all duration-300 hover:translate-x-1">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-white/30 transition-all duration-300">
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm group-hover:text-white/95 transition-colors">{feature.title}</p>
                <p className="text-white/65 text-xs mt-1 group-hover:text-white/75 transition-colors">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé do painel */}
        <div className="relative z-10 mt-12 pt-6 border-t border-white/15">
          <p className="text-white/50 text-xs">
            © {new Date().getFullYear()} ProSindWeb · São Paulo, SP
          </p>
          <p className="text-white/40 text-xs mt-2">
            Plataforma segura com criptografia de ponta
          </p>
        </div>
      </div>

      {/* Painel direito - Formulário */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12 xl:px-16 bg-gradient-to-b from-background via-background to-primary/5">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile: Logo + Back */}
          <div className="flex items-center justify-between mb-8 lg:mb-10">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-[-4px] duration-300"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Link>
            <div className="lg:hidden">
              <Logo size="sm" />
            </div>
          </div>

          {/* Título com melhor hierarquia visual */}
          <div className="mb-8">
            <h2 className="text-3xl lg:text-3xl font-bold text-foreground leading-tight">
              {getTitle()}
            </h2>
            <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">
              {getSubtitle()}
            </p>
          </div>

          {/* Separador visual */}
          <div className="h-px bg-gradient-to-r from-border via-border to-transparent mb-6" />

          {/* Login Form */}
          {view === "login" && (
            <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={`pl-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.email ? "border-destructive" : ""}`}
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>
                {errors.email && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`pl-11 pr-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.password ? "border-destructive" : ""}`}
                  />
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-border" />
                  <span className="text-muted-foreground">Lembrar-me</span>
                </label>
                <button
                  type="button"
                  onClick={() => switchView("forgot-password")}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 transition-all duration-300" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Entrando..." : "Entrar"}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button 
                type="button"
                variant="outline"
                className="w-full h-12 text-sm font-semibold border-border/50 hover:bg-secondary/50 transition-all duration-300"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </Button>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => switchView("signup")}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Cadastre-se
                </button>
              </p>
            </form>
          )}

          {/* Signup Form */}
          {view === "signup" && (
            <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">Nome completo</Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className={`pl-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.name ? "border-destructive" : ""}`}
                  />
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>
                {errors.name && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={`pl-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.email ? "border-destructive" : ""}`}
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>
                {errors.email && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 text-sm flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-blue-800 dark:text-blue-200 text-xs">
                  Após o cadastro, você receberá um email para confirmar sua conta e definir sua senha pessoal.
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 transition-all duration-300" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Cadastrando..." : "Criar conta"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => switchView("login")}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Entre aqui
                </button>
              </p>
            </form>
          )}

          {/* Forgot Password Form */}
          {view === "forgot-password" && (
            <form className="space-y-6 animate-fade-in" onSubmit={handleForgotPassword}>
              {fromExpiredLink && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200 flex gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>O link anterior expirou. Solicite um novo link abaixo.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={`pl-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.email ? "border-destructive" : ""}`}
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>
                {errors.email && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 transition-all duration-300" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>

              <button
                type="button"
                onClick={() => switchView("login")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2 rounded-lg hover:bg-secondary/50 duration-300"
              >
                <ArrowLeft className="inline-block w-4 h-4 mr-2" />
                Voltar para o login
              </button>
            </form>
          )}

          {/* Reset Password Form */}
          {view === "reset-password" && (
            <form className="space-y-6 animate-fade-in" onSubmit={handleResetPassword}>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`pl-11 pr-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.password ? "border-destructive" : ""}`}
                  />
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`pl-11 pr-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.confirmPassword ? "border-destructive" : ""}`}
                  />
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 transition-all duration-300" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Atualizando..." : "Redefinir senha"}
              </Button>
            </form>
          )}

          {/* First Access Form */}
          {view === "first-access" && (
            <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
              <div className="bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-xl p-4 text-sm flex gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-primary mb-1">Primeiro acesso</p>
                  <p className="text-xs text-muted-foreground">
                    Você está usando uma senha temporária. Crie uma senha pessoal agora por segurança.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`pl-11 pr-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.password ? "border-destructive" : ""}`}
                  />
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`pl-11 pr-11 h-12 border-border/50 focus:border-primary/50 transition-colors ${errors.confirmPassword ? "border-destructive" : ""}`}
                  />
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-sm font-semibold bg-primary hover:bg-primary/90 transition-all duration-300" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Salvando..." : "Salvar senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
