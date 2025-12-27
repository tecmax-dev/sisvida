import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

type ConfirmationStatus = "loading" | "success" | "error" | "expired" | "already_confirmed";

interface EmailConfirmation {
  id: string;
  user_id: string;
  email: string;
  token: string;
  created_at: string;
  confirmed_at: string | null;
  expires_at: string;
}

export default function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConfirmationStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    const confirmEmail = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Token de confirmação não encontrado.");
        return;
      }

      try {
        // Find pending confirmation by token
        const { data, error: fetchError } = await supabase
          .from("email_confirmations" as any)
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (fetchError) {
          console.error("Error fetching confirmation:", fetchError);
          setStatus("error");
          setErrorMessage("Erro ao verificar token.");
          return;
        }

        const confirmation = data as unknown as EmailConfirmation | null;

        if (!confirmation) {
          setStatus("error");
          setErrorMessage("Token de confirmação inválido ou já utilizado.");
          return;
        }

        // Check if already confirmed
        if (confirmation.confirmed_at) {
          setStatus("already_confirmed");
          return;
        }

        // Check if expired (24 hours)
        const createdAt = new Date(confirmation.created_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
          setStatus("expired");
          return;
        }

        // Confirm email
        const { error: updateError } = await supabase
          .from("email_confirmations" as any)
          .update({ confirmed_at: new Date().toISOString() })
          .eq("id", confirmation.id);

        if (updateError) {
          console.error("Error confirming email:", updateError);
          setStatus("error");
          setErrorMessage("Erro ao confirmar email.");
          return;
        }

        // Update user profile if needed
        if (confirmation.user_id) {
          await supabase
            .from("profiles")
            .update({ email_confirmed: true } as any)
            .eq("user_id", confirmation.user_id);
        }

        setStatus("success");

        // Redirect to clinic setup after 3 seconds
        setTimeout(() => {
          navigate("/clinic-setup");
        }, 3000);

      } catch (error: any) {
        console.error("Confirmation error:", error);
        setStatus("error");
        setErrorMessage(error.message || "Erro desconhecido.");
      }
    };

    confirmEmail();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="inline-block mb-8">
          <Logo size="md" />
        </Link>

        <div className="bg-card rounded-xl shadow-lg p-8 border">
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Confirmando seu email...
              </h1>
              <p className="text-muted-foreground">
                Aguarde enquanto verificamos seu token.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Email confirmado!
              </h1>
              <p className="text-muted-foreground mb-6">
                Sua conta foi ativada com sucesso. Você será redirecionado para configurar sua clínica...
              </p>
              <Button onClick={() => navigate("/clinic-setup")} className="w-full">
                Configurar minha clínica
              </Button>
            </>
          )}

          {status === "already_confirmed" && (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10 text-blue-600" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Email já confirmado
              </h1>
              <p className="text-muted-foreground mb-6">
                Este email já foi confirmado anteriormente.
              </p>
              <Button onClick={() => navigate("/dashboard")} className="w-full">
                Ir para o Dashboard
              </Button>
            </>
          )}

          {status === "expired" && (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-10 w-10 text-yellow-600" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Link expirado
              </h1>
              <p className="text-muted-foreground mb-6">
                O link de confirmação expirou. Solicite um novo email de confirmação.
              </p>
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
                Fazer login
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Erro na confirmação
              </h1>
              <p className="text-muted-foreground mb-6">
                {errorMessage || "Ocorreu um erro ao confirmar seu email."}
              </p>
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
                Voltar ao login
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
