import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, Lock, CheckCircle, KeyRound, MessageSquare, AlertCircle } from "lucide-react";

/**
 * Recuperação de senha do app /sindicato.
 * Padrão: CPF -> link pessoal pelo WhatsApp oficial (uso único, 30 min).
 * E-mail aparece somente quando o cadastro não tem WhatsApp disponível.
 */
type Step = "identify" | "sent" | "email" | "verify_code" | "validate_birth_year" | "password" | "success" | "invalid_link";

const formatCpf = (value: string) => {
  const n = value.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
};

const callFn = async (name: string, body: unknown) => {
  const supabaseUrl = (supabase as any).supabaseUrl as string;
  const anonKey = (supabase as any).supabaseKey as string;
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data: data as any };
};

const Icon = ({ children }: { children: React.ReactNode }) => (
  <div className="flex justify-center mb-4">
    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">{children}</div>
  </div>
);

export default function MobilePasswordResetPage() {
  const { token } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(token ? "password" : "identify");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(!!token);
  const [linkError, setLinkError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const fail = (description: string, title = "Atenção") => toast({ title, description, variant: "destructive" });

  // Link recebido pelo WhatsApp: valida antes de mostrar o formulário
  useEffect(() => {
    if (!token) return;
    callFn("app-password-reset", { action: "check", token }).then(({ ok, data }) => {
      setChecking(false);
      if (!ok || !data?.success) { setLinkError(data?.error || "Link inválido."); setStep("invalid_link"); }
    });
  }, [token]);

  // Link antigo de e-mail (?email=&code=)
  useEffect(() => {
    if (token) return;
    const e = searchParams.get("email")?.trim();
    const c = searchParams.get("code")?.trim();
    if (!e || !e.includes("@")) return;
    setEmail(e);
    if (c && c.length === 6) { setCode(c); setStep("validate_birth_year"); } else setStep("verify_code");
  }, [searchParams, token]);

  const handleCpf = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) return fail("Digite os 11 dígitos do seu CPF.", "CPF inválido");
    setLoading(true);
    try {
      const { ok, data } = await callFn("app-password-reset", { action: "request", cpf: digits });
      if (!ok || !data?.success) return fail(data?.error || "Não foi possível enviar agora. Tente novamente.");
      if (data.channel === "email") {
        toast({ title: "WhatsApp indisponível", description: data.message });
        setStep("email");
      } else setStep("sent");
    } finally { setLoading(false); }
  };

  const handleEmail = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email.includes("@")) return fail("Digite um e-mail válido.", "E-mail inválido");
    setLoading(true);
    try {
      const { ok, data } = await callFn("send-password-reset-email", { email, channel: "email" });
      if (!ok || data?.error) return fail(data?.error || data?.message || "Não foi possível enviar o e-mail.");
      toast({ title: "Código enviado", description: "Se o e-mail estiver cadastrado, você receberá um código." });
      setStep("verify_code");
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (newPassword.length < 6) return fail("A senha deve ter no mínimo 6 caracteres.", "Senha muito curta");
    if (newPassword !== confirmPassword) return fail("A confirmação não corresponde.", "Senhas não conferem");
    setLoading(true);
    try {
      if (token) {
        const { ok, data } = await callFn("app-password-reset", { action: "redeem", token, new_password: newPassword });
        if (!ok || !data?.success) return fail(data?.error || "Não foi possível redefinir a senha.");
      } else {
        const { data, error } = await supabase.rpc("reset_patient_password_by_code", {
          p_email: email, p_code: code, p_birth_year: parseInt(birthYear), p_new_password: newPassword,
        } as any);
        const result = data as Record<string, unknown> | null;
        if (error || !result?.success) return fail((result?.message as string) || error?.message || "Não foi possível redefinir a senha.");
      }
      setStep("success");
    } finally { setLoading(false); }
  };

  const primary = "w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold";

  const renderStep = () => {
    if (checking) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;
    switch (step) {
      case "identify":
        return (
          <form onSubmit={handleCpf} className="space-y-6">
            <Icon><MessageSquare className="h-8 w-8 text-emerald-600" /></Icon>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Recuperar Senha</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Digite seu CPF. Enviaremos um link para criar nova senha no WhatsApp do celular cadastrado.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" inputMode="numeric" placeholder="000.000.000-00" value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))} className="h-12" disabled={loading} />
            </div>
            <Button type="submit" className={primary} disabled={loading || cpf.replace(/\D/g, "").length !== 11}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : <><MessageSquare className="mr-2 h-4 w-4" />Receber link no WhatsApp</>}
            </Button>
          </form>
        );
      case "sent":
        return (
          <div className="text-center space-y-5">
            <Icon><CheckCircle className="h-8 w-8 text-emerald-600" /></Icon>
            <h2 className="text-xl font-semibold text-foreground">Confira seu WhatsApp</h2>
            <p className="text-sm text-muted-foreground">
              Se o CPF estiver cadastrado, você vai receber uma mensagem do sindicato com o botão <strong>"Criar nova senha"</strong>.
              O link vale por 30 minutos e funciona uma única vez.
            </p>
            <p className="text-xs text-muted-foreground">Não chegou? Aguarde alguns minutos antes de pedir de novo, ou procure o sindicato.</p>
            <Button onClick={() => navigate("/app")} variant="outline" className="w-full h-12">Voltar ao login</Button>
          </div>
        );
      case "email":
        return (
          <form onSubmit={handleEmail} className="space-y-6">
            <Icon><Mail className="h-8 w-8 text-emerald-600" /></Icon>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Recuperar pelo e-mail</h2>
              <p className="text-sm text-muted-foreground mt-2">Seu cadastro não tem WhatsApp disponível. Digite o e-mail cadastrado para receber um código.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" disabled={loading} />
            </div>
            <Button type="submit" className={primary} disabled={loading || !email}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : "Enviar código por e-mail"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Sem e-mail cadastrado? Procure o atendimento do sindicato.</p>
          </form>
        );
      case "verify_code":
        return (
          <form onSubmit={(e) => { e.preventDefault(); if (code.length !== 6) return fail("Digite o código de 6 dígitos.", "Código inválido"); setStep("validate_birth_year"); }} className="space-y-6">
            <Icon><KeyRound className="h-8 w-8 text-emerald-600" /></Icon>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Código do e-mail</h2>
              <p className="text-sm text-muted-foreground mt-2">Digite o código de 6 dígitos enviado para o seu e-mail.</p>
            </div>
            <Input inputMode="numeric" placeholder="000000" value={code} maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-14 text-center text-2xl tracking-[0.5em] font-mono" />
            <Button type="submit" className={primary} disabled={code.length !== 6}>Continuar</Button>
          </form>
        );
      case "validate_birth_year":
        return (
          <form onSubmit={(e) => { e.preventDefault(); if (birthYear.length !== 4) return fail("Digite o ano com 4 dígitos.", "Ano inválido"); setStep("password"); }} className="space-y-6">
            <Icon><CheckCircle className="h-8 w-8 text-emerald-600" /></Icon>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Validar Identidade</h2>
              <p className="text-sm text-muted-foreground mt-2">Informe seu <strong>ano de nascimento</strong>.</p>
            </div>
            <Input inputMode="numeric" placeholder="Ex: 1985" value={birthYear} maxLength={4}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="h-12 text-center text-xl font-semibold" />
            <Button type="submit" className={primary} disabled={birthYear.length !== 4}>Continuar</Button>
          </form>
        );
      case "password":
        return (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <Icon><Lock className="h-8 w-8 text-emerald-600" /></Icon>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Nova Senha</h2>
              <p className="text-sm text-muted-foreground mt-2">Digite sua nova senha de acesso ao app.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12" disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12" disabled={loading} />
            </div>
            <Button type="submit" className={primary} disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar nova senha"}
            </Button>
          </form>
        );
      case "invalid_link":
        return (
          <div className="text-center space-y-5">
            <Icon><AlertCircle className="h-8 w-8 text-destructive" /></Icon>
            <h2 className="text-xl font-semibold text-foreground">Link indisponível</h2>
            <p className="text-sm text-muted-foreground">{linkError}</p>
            <Button onClick={() => navigate("/app/recuperar-senha")} className={primary}>Pedir novo link</Button>
          </div>
        );
      case "success":
        return (
          <div className="text-center space-y-6">
            <Icon><CheckCircle className="h-10 w-10 text-emerald-600" /></Icon>
            <h2 className="text-xl font-semibold text-foreground">Senha Alterada!</h2>
            <p className="text-sm text-muted-foreground">Agora você pode entrar com a nova senha.</p>
            <Button onClick={() => navigate("/app")} className={primary}>Ir para Login</Button>
          </div>
        );
    }
  };

  const goBack = () => {
    if (step === "email") setStep("identify");
    else if (step === "verify_code") setStep("email");
    else if (step === "validate_birth_year") setStep("verify_code");
    else if (step === "password" && !token) setStep("validate_birth_year");
    else navigate("/app");
  };

  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col">
      <div className="bg-emerald-600 text-white py-6 px-4">
        <div className="flex items-center gap-4">
          {step !== "success" && (
            <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-full transition-colors" aria-label="Voltar">
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">SECMI</h1>
            <p className="text-xs opacity-90">Recuperação de Senha</p>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-white rounded-t-3xl -mt-2 p-6">
        <Card className="border-0 shadow-none">
          <CardContent className="px-0 pt-4">{renderStep()}</CardContent>
        </Card>
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 Prosinge</p>
          <p className="mt-1">Todos os Direitos Reservados</p>
        </div>
      </div>
    </div>
  );
}
