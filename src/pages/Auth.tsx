import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, KeyRound } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { z } from "zod";
import authDashboardMockup from "@/assets/auth-dashboard-mockup.png";
import { authTrace, maskEmail } from "@/lib/authTrace";

// OAuth redirects MUST stay on the same origin to preserve PKCE state.
// Using a different domain between the auth start and the callback will cause:
// "Unable to exchange external code".
const getAppBaseUrl = () => {
  if (typeof window === "undefined") return "";
  return window.location.origin;
};

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

type AuthView = "login" | "signup" | "forgot-password" | "reset-password" | "first-access";

const PUBLISHED_FALLBACK_HOST = "eclini.lovable.app";
const CANONICAL_CUSTOM_DOMAIN = "https://app.eclini.com.br";

export default function Auth() {
  // Canonicaliza APENAS o domínio publicado fallback (eclini.lovable.app) para o domínio customizado.
  // Importante: não fazer isso durante callbacks OAuth (quando há ?code=... ou hash), para não quebrar PKCE.
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

  // useRef para controlar o fluxo de primeiro acesso - atualizado imediatamente sem re-render
  const isFirstAccessFlowRef = useRef(false);
  
  // PROTEÇÃO ANTI-LOOP: flag de execução para bloquear login concorrente
  const isAuthenticatingRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  
  const [errors, setErrors] = useState<{ 
    email?: string; 
    password?: string; 
    confirmPassword?: string;
    name?: string;
  }>({});

  // useRef para controlar o fluxo de recuperação - atualizado imediatamente sem re-render
  const isRecoveryFlowRef = useRef(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Importante: não forçar troca de domínio aqui.
  // Se o login iniciar em um domínio e retornar em outro, o PKCE quebra e gera
  // "Unable to exchange external code".
  // A canonicalização deve ser feita via redirecionamento no provedor de hosting/DNS,
  // não no cliente durante o fluxo de OAuth.

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
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.substring(1));

    // Erros podem vir no hash (ex.: recovery) OU na query (ex.: OAuth).
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

    // Debug seguro: não logar tokens.
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

    // Só tratar como "link de recuperação" quando for explicitamente recovery.
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

    // Caso contrário, é erro de autenticação (ex.: Google OAuth) — não confundir com recovery.
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

    authTrace("Auth.submit", {
      view,
      email: email ? maskEmail(email) : "[empty]",
    });
    
    // PROTEÇÃO ANTI-LOOP: bloquear execução concorrente
    if (isAuthenticatingRef.current) {
      console.warn('[Auth] Login já em andamento, ignorando chamada duplicada');
      authTrace("Auth.blocked.concurrent");
      return;
    }
    
    // PROTEÇÃO ANTI-LOOP: evitar re-login após navegação
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

        // Login bem-sucedido - redirect IMEDIATO sem queries adicionais
        // A página de destino fará a verificação de roles/permissões
        if (signInData.user) {
          hasNavigatedRef.current = true;
          authTrace("Auth.navigate", { to: "/dashboard" });
          // Redirecionar para dashboard - a página fará o roteamento correto
          navigate("/dashboard", { replace: true });
        }
        
        // NÃO resetar loading após navegação para evitar flash
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
          // DESATIVADO: Envio de credenciais via Edge Function
          // Motivo: Todas as Edge Functions desativadas no login/bootstrap
          // O fluxo de cadastro agora apenas cria a conta e faz logout
          
          // Fazer logout para que o usuário faça login com as credenciais recebidas
          await supabase.auth.signOut();

          toast({
            title: "Conta criada com sucesso!",
            description: "Verifique seu email para confirmar a conta e definir sua senha.",
          });

          // Voltar para a tela de login
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
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getAppBaseUrl()}/auth`,
          scopes: "https://www.googleapis.com/auth/userinfo.email",
        },
      });

      if (error) throw error;
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
      case "login": return "Entre para acessar sua clínica";
      case "signup": return "Comece a gerenciar sua clínica hoje";
      case "forgot-password": return "Digite seu email para receber o link de recuperação";
      case "reset-password": return "Digite sua nova senha";
      case "first-access": return "Para sua segurança, crie uma senha pessoal";
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background decorativo sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradiente de fundo */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        
        {/* Círculos decorativos sutis */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Container principal */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8 lg:py-12">
        <div className="w-full max-w-4xl bg-card/95 backdrop-blur-sm rounded-2xl shadow-lg border border-border/50 overflow-hidden flex flex-col lg:flex-row">
          
          {/* Painel esquerdo - Formulário */}
          <div className="flex-1 p-5 sm:p-6 lg:p-8">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao site
            </Link>
            
            <div className="mb-6">
              <Logo size="md" />
            </div>
            
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-1.5">
              {getTitle()}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {getSubtitle()}
            </p>

            {/* Forgot Password Form */}
            {view === "forgot-password" && (
              <form className="space-y-4" onSubmit={handleForgotPassword}>
                {fromExpiredLink && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                    O link anterior expirou ou já foi utilizado. Solicite um novo link abaixo.
                  </div>
                )}
                <div>
                  <Label htmlFor="email" className="text-sm">E-mail</Label>
                  <div className="relative mt-1">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Digite seu e-mail"
                      className={`pl-9 h-10 ${errors.email ? "border-destructive" : ""}`}
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs text-destructive">{errors.email}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-10" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar link de recuperação
                </Button>

                <button
                  type="button"
                  onClick={() => switchView("login")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="inline-block w-3.5 h-3.5 mr-1" />
                  Voltar para o login
                </button>
              </form>
            )}

            {/* Reset Password Form */}
            {view === "reset-password" && (
              <form className="space-y-4" onSubmit={handleResetPassword}>
                <div>
                  <Label htmlFor="password" className="text-sm">Nova senha</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Informe sua senha"
                      className={`pl-9 pr-9 h-10 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-destructive">{errors.password}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm">Confirmar nova senha</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme sua senha"
                      className={`pl-9 pr-9 h-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-10" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Redefinir senha
                </Button>
              </form>
            )}

            {/* First Access Form */}
            {view === "first-access" && (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-0.5 text-primary">🔐 Primeiro acesso detectado</p>
                  <p className="text-xs text-muted-foreground">
                    Você está usando uma senha temporária. Por segurança, crie uma senha pessoal agora.
                  </p>
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm">Nova senha</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Informe sua senha"
                      className={`pl-9 pr-9 h-10 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-destructive">{errors.password}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm">Confirmar nova senha</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme sua senha"
                      className={`pl-9 pr-9 h-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-10" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar minha senha
                </Button>
              </form>
            )}

            {/* Login/Signup Form */}
            {(view === "login" || view === "signup") && (
              <>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {view === "signup" && (
                    <div>
                      <Label htmlFor="name" className="text-sm">Nome completo</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className={`mt-1 h-10 ${errors.name ? "border-destructive" : ""}`}
                      />
                      {errors.name && (
                        <p className="mt-1 text-xs text-destructive">{errors.name}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="email" className="text-sm">E-mail</Label>
                    <div className="relative mt-1">
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Digite seu e-mail"
                        className={`pl-9 h-10 ${errors.email ? "border-destructive" : ""}`}
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>

                  {view === "login" && (
                    <div>
                      <Label htmlFor="password" className="text-sm">Senha</Label>
                      <div className="relative mt-1">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Informe sua senha"
                          className={`pl-9 pr-9 h-10 ${errors.password ? "border-destructive" : ""}`}
                        />
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1 text-xs text-destructive">{errors.password}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => switchView("forgot-password")}
                        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <KeyRound className="h-3 w-3" />
                        Esqueci a senha
                      </button>
                    </div>
                  )}

                  <Button type="submit" className="w-full h-10 gap-2" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {view === "login" ? "Entrar" : "Criar conta"}
                    {!loading && <ArrowLeft className="h-3.5 w-3.5 rotate-180" />}
                  </Button>
                </form>

                {view === "login" && (
                  <>
                    <div className="relative my-4">
                      <Separator className="my-3" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                        ou continue com
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-10 gap-2"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Entrar com Google
                    </Button>
                  </>
                )}

                <p className="mt-4 text-center text-xs text-muted-foreground">
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
          
          {/* Painel direito - Promocional com cores da logomarca */}
          <div 
            className="hidden lg:flex lg:w-[320px] relative overflow-hidden p-5"
            style={{
              background: 'linear-gradient(135deg, hsl(195 100% 45%) 0%, hsl(180 80% 45%) 50%, hsl(85 70% 50%) 100%)'
            }}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-8 right-8 w-24 h-24 border-2 border-white rounded-full" />
              <div className="absolute bottom-16 left-8 w-20 h-20 border-2 border-white rounded-full" />
              <div className="absolute top-1/2 right-1/3 w-12 h-12 border border-white rounded-full" />
            </div>
            
            {/* Conteúdo */}
            <div className="relative z-10 flex flex-col h-full justify-between">
              {/* Mockup do dashboard */}
              <div className="relative mb-4">
                <img 
                  src={authDashboardMockup}
                  alt="Sistema Eclini - Painel com Cards"
                  className="rounded-lg shadow-xl border-2 border-white/20"
                />
                {/* Brilho */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none" />
              </div>
              
              {/* Card informativo */}
              <div className="bg-white rounded-lg p-4 shadow-lg">
                <p className="text-xs text-muted-foreground mb-0.5">
                  Clínicas orientadas por dados
                </p>
                <h3 className="text-base font-bold text-primary mb-2">
                  crescem <span className="text-lg">30%</span> mais!
                </h3>
                
                <p className="text-xs text-muted-foreground mb-2">
                  Com o <strong>Módulo de Indicadores</strong>, você pode ver em tempo real:
                </p>
                
                <ul className="space-y-0.5 text-xs text-foreground mb-3">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                    Ocupação da agenda
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                    Cancelamentos e inadimplência
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                    Ticket médio e contas a receber
                  </li>
                </ul>
                
                <Button size="sm" className="w-full h-8 text-xs gap-1.5" asChild>
                  <Link to="/cadastro">
                    Quero saber mais
                    <ArrowLeft className="h-3 w-3 rotate-180" />
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
