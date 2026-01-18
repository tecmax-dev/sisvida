import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function MobileWelcomePage() {
  const navigate = useNavigate();

  const handleCadastro = () => {
    navigate("/app/filiacao");
  };

  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large circle top-left */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-500 rounded-full opacity-80" />
        
        {/* Medium circle left */}
        <div className="absolute top-[45%] -left-8 w-32 h-32 bg-emerald-500 rounded-full opacity-90" />
        
        {/* Small circle bottom-left */}
        <div className="absolute top-[65%] left-16 w-16 h-16 bg-emerald-700 rounded-full opacity-80" />
        
        {/* Medium circle center */}
        <div className="absolute top-[50%] left-[45%] w-20 h-20 bg-emerald-500 rounded-full opacity-60" />
        
        {/* Dashed curved lines - SVG */}
        <svg 
          className="absolute inset-0 w-full h-full" 
          viewBox="0 0 400 800" 
          fill="none" 
          preserveAspectRatio="xMidYMid slice"
        >
          {/* First curved dashed line */}
          <path 
            d="M 180 200 Q 280 350 200 450 Q 120 550 180 700" 
            stroke="rgba(255,255,255,0.3)" 
            strokeWidth="2" 
            strokeDasharray="8 8" 
            fill="none"
          />
          {/* Second curved dashed line */}
          <path 
            d="M 220 180 Q 320 330 240 430 Q 160 530 220 680" 
            stroke="rgba(255,255,255,0.2)" 
            strokeWidth="2" 
            strokeDasharray="8 8" 
            fill="none"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-end relative z-10 px-6 pb-8">
        {/* Text content */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-3">
            Seja bem-vindo(a)
          </h1>
          <p className="text-white/90 text-base leading-relaxed">
            Entre em sua conta ou cadastre-se. Para acesso sem cadastro, clique na última opção.
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleCadastro}
            className="w-full py-6 text-lg font-semibold bg-white text-emerald-700 hover:bg-gray-100 rounded-full shadow-lg"
          >
            Cadastrar-se agora
          </Button>
          
          <Button
            onClick={() => navigate("/app/login")}
            className="w-full py-6 text-lg font-semibold bg-emerald-700 text-white hover:bg-emerald-800 rounded-full border-2 border-emerald-500"
          >
            Já sou associado
          </Button>
          
          <button
            onClick={() => navigate("/app/home-publico")}
            className="w-full py-4 text-base font-semibold text-white hover:text-white/80 transition-colors"
          >
            Continuar sem cadastro
          </button>
        </div>
      </div>
    </div>
  );
}
