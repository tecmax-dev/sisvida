import { Instagram, Facebook, Youtube, Globe, Phone } from "lucide-react";

export function MobileFooter() {
  return (
    <footer className="bg-slate-800 text-white py-6 mt-4">
      <div className="px-4 text-center">
        <p className="text-sm mb-3">Nossos canais de comunicação</p>
        <div className="flex justify-center gap-4 mb-4">
          <a href="#" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Instagram className="h-5 w-5" /></a>
          <a href="#" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Facebook className="h-5 w-5" /></a>
          <a href="#" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Youtube className="h-5 w-5" /></a>
          <a href="#" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Globe className="h-5 w-5" /></a>
        </div>
        <p className="text-xs opacity-70">© 2026 I & B Tecnologia. Todos os Direitos Reservados</p>
      </div>
      {/* WhatsApp FAB */}
      <a href="https://wa.me/5573999999999" className="fixed bottom-20 right-4 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-50">
        <Phone className="h-6 w-6 text-white" />
      </a>
    </footer>
  );
}
