import { AlertTriangle, Wrench, Phone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MaintenanceBannerProps {
  reason?: string | null;
}

export function MaintenanceBanner({ reason }: MaintenanceBannerProps) {
  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-warning/10 border-warning/30 py-3">
      <div className="flex items-center justify-center gap-3 text-sm">
        <div className="flex items-center gap-2 text-warning">
          <Wrench className="h-4 w-4 animate-pulse" />
          <span className="font-medium">Sistema em Manutenção</span>
        </div>
        <span className="text-muted-foreground hidden sm:inline">|</span>
        <span className="text-muted-foreground hidden sm:inline">
          {reason || "Estamos realizando ajustes para melhorar sua experiência."}
        </span>
        <a 
          href="tel:+5571982786864" 
          className="flex items-center gap-1 text-primary hover:underline ml-2"
        >
          <Phone className="h-3 w-3" />
          <span className="hidden sm:inline">Suporte</span>
        </a>
      </div>
    </Alert>
  );
}
