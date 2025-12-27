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
import dashboardMockup from "@/assets/dashboard-mockup.png";

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
  
  // useRef para controlar o fluxo de primeiro acesso - atualizado imediatamente sem re-render
  const isFirstAccessFlowRef = useRef(false);
  const [errors, setErrors] = useState<{ 
    email?: string; 
    password?: string; 
    confirmPassword?: string;
    name?: string 
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
          
          <h2 className="mt-8 text-center text-2xl font-bold text-foreground">
            {getTitle()}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {getSubtitle()}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          {/* Forgot Password Form */}
          {view === "forgot-password" && (
            <form className="space-y-5" onSubmit={handleForgotPassword}>
              {fromExpiredLink && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                  O link anterior expirou ou já foi utilizado. Solicite um novo link abaixo.
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
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
                    placeholder="••••••••"
                    className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

              <div>
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`pl-10 pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                  />
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Redefinir senha
              </Button>
            </form>
          )}

          {/* First Access - Create Personal Password */}
          {view === "first-access" && (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm text-primary dark:bg-primary/5">
                <p className="font-medium mb-1">🔐 Primeiro acesso detectado</p>
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
                    placeholder="••••••••"
                    className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
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
                    placeholder="••••••••"
                    className={`pl-10 pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
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
                  <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
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
                      className={`mt-1.5 ${errors.name ? "border-destructive" : ""}`}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-destructive">{errors.name}</p>
                    )}
                  </div>
                )}

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

                {view === "login" && (
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => switchView("forgot-password")}
                        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
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
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {view === "login" ? "Entrar" : "Criar conta"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {view === "login" ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
                <button
                  type="button"
                  onClick={() => switchView(view === "login" ? "signup" : "login")}
                  className="font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {view === "login" ? "Criar conta" : "Fazer login"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Visual Profissional */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        {/* Imagem de fundo - Médica profissional */}
        <img 
          src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1200&q=80" 
          alt="Profissional de saúde"
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Overlay gradiente para legibilidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/60 to-primary/30" />
        
        {/* Screenshot do sistema sobreposto - posicionado no canto superior direito */}
        <div className="absolute right-4 top-6 w-[260px] transform rotate-2 hover:rotate-0 transition-transform duration-500 group">
          <div className="relative">
            <img 
              src={dashboardMockup}
              alt="Sistema Eclini - Agenda"
              className="rounded-xl shadow-2xl border-4 border-white/20 group-hover:shadow-primary/30 transition-all duration-500"
            />
            {/* Brilho sutil */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
          </div>
        </div>
        
        {/* Conteúdo textual na parte inferior */}
        <div className="relative z-10 flex flex-col justify-end items-start p-10 text-left w-full">
          <h3 className="text-3xl font-bold text-white drop-shadow-lg">
            Simplifique sua gestão
          </h3>
          <p className="mt-3 text-lg text-white/90 max-w-md drop-shadow-md">
            Agendamento inteligente, lembretes automáticos e menos faltas. 
            Tudo para sua clínica funcionar melhor.
          </p>
          
          {/* Cards de estatísticas em linha */}
          <div className="mt-6 flex gap-3">
            {[
              { value: "50%", label: "menos faltas" },
              { value: "2x", label: "mais produtivo" },
              { value: "24/7", label: "disponível" },
              { value: "100%", label: "digital" },
            ].map((stat, i) => (
              <div
                key={i}
                className="px-4 py-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/25"
              >
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
