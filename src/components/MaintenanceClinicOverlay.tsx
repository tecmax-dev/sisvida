import { Wrench, Phone, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface MaintenanceClinicOverlayProps {
  reason?: string | null;
}

export function MaintenanceClinicOverlay({ reason }: MaintenanceClinicOverlayProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="max-w-md mx-auto p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-warning/10 flex items-center justify-center">
          <Wrench className="h-10 w-10 text-warning animate-pulse" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Sistema em Manutenção
        </h1>
        
        <p className="text-muted-foreground mb-4">
          {reason || "Estamos realizando melhorias para oferecer uma experiência ainda melhor."}
        </p>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
          <Clock className="h-4 w-4" />
          <span>Retornaremos em breve</span>
        </div>

        <div className="p-4 bg-muted rounded-lg mb-6">
          <h3 className="font-medium mb-3">Precisa de ajuda urgente?</h3>
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
