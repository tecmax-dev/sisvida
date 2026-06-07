import { MessageCircle } from "lucide-react";

export function SindicatoWhatsappBanner() {
  const phone = "557332239980";
  const display = "(73) 3223-9980";
  const message = encodeURIComponent("Olá! Vim pelo portal e gostaria de atendimento.");
  return (
    <a
      href={`https://wa.me/${phone}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block mb-6 rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-500 to-green-600 p-5 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 animate-fade-in"
    >
      <div className="flex items-center gap-4 text-white">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40">
          <MessageCircle className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-white/90">
            Atenção · Novo Atendimento
          </div>
          <div className="text-lg sm:text-xl font-bold leading-tight">
            WhatsApp do Sindicato: {display}
          </div>
          <div className="text-sm text-white/90">
            Toque aqui para falar com a gente agora pelo WhatsApp.
          </div>
        </div>
      </div>
    </a>
  );
}