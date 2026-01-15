import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import illustrationAjuda from "@/assets/mobile/illustration-ajuda.png";

export function MobileHelpSection() {
  const navigate = useNavigate();

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-bold text-gray-800 tracking-wide mb-3">PRECISA DE AJUDA?</h3>
      
      <div 
        className="bg-gray-50 rounded-xl p-5 flex items-center justify-between border border-gray-200"
      >
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 text-lg mb-3">Como chegar até nós?</h4>
          <Button 
            onClick={() => navigate("/app/ajuda")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
          >
            Ver no mapa
          </Button>
        </div>
        
        <div className="w-28 h-28 flex-shrink-0">
          <img 
            src={illustrationAjuda} 
            alt="Ajuda"
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </section>
  );
}
