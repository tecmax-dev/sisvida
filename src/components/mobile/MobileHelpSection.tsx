import { useNavigate } from "react-router-dom";
import { MapPin, Phone, MessageCircle } from "lucide-react";

export function MobileHelpSection() {
  const navigate = useNavigate();

  const handleWhatsApp = () => {
    window.open("https://wa.me/5573991234567", "_blank");
  };

  return (
    <section className="px-4 py-4 pb-8">
      <h3 className="text-sm font-bold text-gray-800 tracking-wide mb-4">PRECISA DE AJUDA?</h3>
      
      <div className="space-y-3">
        {/* Location Card */}
        <div 
          className="bg-white rounded-xl p-4 flex items-center gap-4 border border-gray-200 shadow-sm cursor-pointer transition-all duration-200 active:scale-[0.98]"
          onClick={() => navigate("/app/ajuda")}
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <MapPin className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">Como chegar até nós?</p>
            <p className="text-xs text-gray-500">Ver localização no mapa</p>
          </div>
        </div>

        {/* Phone Card */}
        <div 
          className="bg-white rounded-xl p-4 flex items-center gap-4 border border-gray-200 shadow-sm cursor-pointer transition-all duration-200 active:scale-[0.98]"
          onClick={() => window.open("tel:+557332812500")}
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Phone className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">Central de Atendimento</p>
            <p className="text-xs text-gray-500">(73) 3281-2500</p>
          </div>
        </div>
      </div>

      {/* WhatsApp Floating Button */}
      <button
        onClick={handleWhatsApp}
        className="fixed bottom-20 right-4 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 z-50 transition-all duration-200 active:scale-90 hover:bg-green-600"
      >
        <MessageCircle className="h-7 w-7 text-white" />
      </button>
    </section>
  );
}
