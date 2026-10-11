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
      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      <span>Falar no WhatsApp: {display}</span>
    </a>
  );
}
