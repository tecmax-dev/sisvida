import { Instagram, Facebook, Youtube, Globe, MessageCircle } from "lucide-react";

export function MobileFooter() {
  const socialLinks = [
    { icon: Instagram, href: "#", gradient: "from-pink-500 via-rose-500 to-orange-500" },
    { icon: Facebook, href: "#", gradient: "from-blue-600 to-blue-700" },
    { icon: Youtube, href: "#", gradient: "from-red-500 to-red-600" },
    { icon: Globe, href: "#", gradient: "from-slate-600 to-slate-700" },
  ];

  return (
    <footer className="bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 text-white py-8 mt-6">
      <div className="px-6 text-center">
        {/* Logo area */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10">
            <img 
              src="/logo-sindicato.png" 
              alt="SECMI" 
              className="w-10 h-10 object-contain opacity-90" 
              onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} 
            />
          </div>
        </div>
        
        <p className="text-sm font-medium text-white/80 mb-1">SECMI</p>
        <p className="text-xs text-white/50 mb-5">Sindicato dos Comerciários de Itabuna</p>
        
        {/* Social links */}
        <div className="flex justify-center gap-3 mb-6">
          {socialLinks.map((social, idx) => (
            <a 
              key={idx}
              href={social.href} 
              className={`w-11 h-11 bg-gradient-to-br ${social.gradient} rounded-xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all duration-300`}
            >
              <social.icon className="h-5 w-5 text-white" />
            </a>
          ))}
        </div>
        
        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4" />
        
        <p className="text-[10px] text-white/40 font-medium">
          © 2026 I & B Tecnologia. Todos os Direitos Reservados
        </p>
      </div>
      
      {/* WhatsApp FAB - Floating Action Button */}
      <a 
        href="https://wa.me/5573999999999" 
        className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-green-500/40 z-50 hover:scale-110 active:scale-95 transition-all duration-300 animate-bounce"
        style={{ animationDuration: '2s' }}
      >
        <MessageCircle className="h-7 w-7 text-white drop-shadow-sm" />
      </a>
    </footer>
  );
}
