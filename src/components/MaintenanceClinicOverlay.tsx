import { Phone, Mail } from "lucide-react";
import maintenanceBanner from "@/assets/prosinge-manutencao.png.asset.json";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface MaintenanceClinicOverlayProps {
  reason?: string | null;
}

export function MaintenanceClinicOverlay({ reason }: MaintenanceClinicOverlayProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto p-6 text-center">
        <img
          src={maintenanceBanner.url}
          alt="Prosinge - Sistema em manutenção"
          className="w-full h-auto rounded-2xl shadow-xl mb-6"
        />

        {reason && (
          <p className="text-muted-foreground mb-4">{reason}</p>
        )}

        <div className="p-4 bg-muted rounded-lg mb-6 max-w-md mx-auto">
          <h3 className="font-medium mb-3">Precisa de ajuda urgente?</h3>
          <div className="space-y-2 text-sm">
            <a href="tel:+551151943839" className="flex items-center justify-center gap-2 text-primary hover:underline">
              <Phone className="h-4 w-4" />
              (11) 5194-3839
            </a>
            <a href="mailto:suporte@prosinge.com.br" className="flex items-center justify-center gap-2 text-primary hover:underline">
              <Mail className="h-4 w-4" />
              suporte@prosinge.com.br
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
