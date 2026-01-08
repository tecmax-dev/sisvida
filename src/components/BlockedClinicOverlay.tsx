import { AlertTriangle, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface BlockedClinicOverlayProps {
  reason?: string;
}

export function BlockedClinicOverlay({ reason }: BlockedClinicOverlayProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="max-w-md mx-auto p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Sistema Indisponível
        </h1>
        
        <p className="text-muted-foreground mb-6">
          O acesso ao sistema está temporariamente suspenso. 
          Entre em contato com o suporte para mais informações.
        </p>

        <div className="p-4 bg-muted rounded-lg mb-6">
          <h3 className="font-medium mb-3">Contato do Suporte</h3>
          <div className="space-y-2 text-sm">
            <a 
              href="tel:+5571982786864" 
              className="flex items-center justify-center gap-2 text-primary hover:underline"
            >
              <Phone className="h-4 w-4" />
              (71) 98278-6864
            </a>
            <a 
              href="mailto:suporte@eclini.com.br" 
              className="flex items-center justify-center gap-2 text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              suporte@eclini.com.br
            </a>
          </div>
        </div>

        <Button variant="outline" onClick={handleSignOut}>
          Sair do Sistema
        </Button>
      </div>
    </div>
  );
}
