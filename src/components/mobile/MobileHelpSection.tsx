import { useNavigate } from "react-router-dom";
import { MapPin, ChevronRight, Navigation, HelpCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileHelpSection() {
  const navigate = useNavigate();

  return (
    <section className="px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800 tracking-wide">PRECISA DE AJUDA?</h3>
        <div className="h-1 w-12 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" />
      </div>
      
      <div 
        className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-3xl p-5 flex items-center gap-4 cursor-pointer border border-emerald-100/50 shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/15 transition-all duration-300 group"
        onClick={() => navigate("/app/ajuda")}
      >
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Localização</span>
          </div>
          <h4 className="font-bold text-gray-800 text-lg leading-snug">Como chegar até nós?</h4>
          <Button 
            size="sm" 
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 rounded-xl px-4 gap-2"
          >
            <Navigation className="h-4 w-4" />
            Ver no mapa
          </Button>
        </div>
        
        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-300">
          <MapPin className="h-9 w-9 text-white drop-shadow-sm" />
        </div>
      </div>

      {/* Quick contact card */}
      <div className="mt-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Phone className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Central de Atendimento</p>
            <p className="text-sm font-bold text-gray-800">(73) 3281-2500</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </section>
  );
}
