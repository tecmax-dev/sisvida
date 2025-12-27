import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight } from "lucide-react";

export default function AwaitingConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email || "";

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
            Credenciais enviadas por email
          </h1>

          <p className="text-muted-foreground mb-2">
            Se o cadastro foi concluído, enviamos sua senha temporária para:
          </p>

          {email ? (
            <p className="font-medium text-foreground mb-6 break-all">{email}</p>
          ) : (
            <p className="font-medium text-foreground mb-6">seu email</p>
          )}

          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-sm text-muted-foreground">
            <p>
              Use o email + senha temporária para fazer login. Se não encontrou,
              verifique Spam/Lixo eletrônico.
            </p>
          </div>

          <div className="space-y-3">
            <Button onClick={() => navigate("/auth")} className="w-full">
              Ir para login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/cadastro")}
              className="w-full"
            >
              Refazer cadastro
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
            <p>
              Observação: não enviamos mais link de confirmação; o recebimento da
              senha no email é a validação.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

