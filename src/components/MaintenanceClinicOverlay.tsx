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

        </div>

        <Button variant="outline" onClick={handleSignOut}>
          Sair do Sistema
        </Button>
      </div>
    </div>
  );
}
