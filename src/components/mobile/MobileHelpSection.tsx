import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileHelpSection() {
  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">PRECISA DE AJUDA?</h3>
      <div className="bg-emerald-50 rounded-2xl p-4 flex items-center gap-4">
        <div className="flex-1">
          <h4 className="font-semibold text-foreground mb-2">Como chegar até nós?</h4>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <MapPin className="h-4 w-4 mr-2" />
            Ver no mapa
          </Button>
        </div>
        <div className="w-20 h-20 bg-emerald-200 rounded-lg" />
      </div>
    </section>
  );
}
