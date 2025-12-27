import { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AwaitingConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  const email = location.state?.email || "";
  const name = location.state?.name || "";

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        title: "Erro",
        description: "Email não encontrado. Por favor, faça o cadastro novamente.",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);

    try {
      // Generate new token
      const confirmationToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Get user ID from existing confirmation
      const { data: existingConfirmation } = await supabase
        .from("email_confirmations" as any)
        .select("user_id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingConfirmation) {
        throw new Error("Confirmação não encontrada");
      }

      // Create new confirmation record
      await supabase
        .from("email_confirmations" as any)
        .insert({
          user_id: (existingConfirmation as any).user_id,
          email: email,
          token: confirmationToken,
          expires_at: expiresAt.toISOString(),
        });

      // Send confirmation email
      await supabase.functions.invoke("send-confirmation-email", {
        body: {
          userEmail: email,
          userName: name,
          confirmationToken: confirmationToken,
        },
      });

      setResent(true);
      toast({
        title: "Email reenviado!",
        description: "Verifique sua caixa de entrada.",
      });
    } catch (error: any) {
      console.error("Error resending email:", error);
      toast({
        title: "Erro ao reenviar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  // If no email in state, redirect to signup
  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <Link to="/" className="inline-block mb-8">
            <Logo size="md" />
          </Link>

          <div className="bg-card rounded-xl shadow-lg p-8 border">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-10 w-10 text-yellow-600" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Sessão expirada
            </h1>
            <p className="text-muted-foreground mb-6">
              Por favor, faça o cadastro novamente.
            </p>
            <Button onClick={() => navigate("/cadastro")} className="w-full">
              Ir para cadastro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-block mb-8">
          <Logo size="md" />
        </Link>

        <div className="bg-card rounded-xl shadow-lg p-8 border">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Confirme seu email
          </h1>
          
          <p className="text-muted-foreground mb-2">
            Enviamos um link de confirmação para:
          </p>
          
          <p className="font-medium text-foreground mb-6 break-all">
            {email}
          </p>

          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-sm text-muted-foreground">
            <p>
              Clique no link enviado para seu email para ativar sua conta e configurar sua clínica.
            </p>
          </div>

          {resent ? (
            <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
              <CheckCircle2 className="h-5 w-5" />
              <span>Email reenviado com sucesso!</span>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handleResendEmail}
              disabled={isResending}
              className="w-full mb-4"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reenviando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reenviar email de confirmação
                </>
              )}
            </Button>
          )}

          <div className="text-sm text-muted-foreground">
            <p>Não recebeu o email?</p>
            <p>Verifique sua pasta de spam ou lixo eletrônico.</p>
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Já confirmou seu email?
            </p>
            <Link to="/auth" className="text-sm text-primary hover:underline font-medium">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
