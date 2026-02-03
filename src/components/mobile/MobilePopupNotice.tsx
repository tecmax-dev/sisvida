import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { PopupNotice } from "@/hooks/usePopupNotices";

interface MobilePopupNoticeProps {
  notices: PopupNotice[];
}

export function MobilePopupNotice({ notices }: MobilePopupNoticeProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (notices.length === 0) return;

    // Carregar avisos já visualizados nesta sessão
    const sessionKey = "popup_notices_dismissed";
    const dismissed = sessionStorage.getItem(sessionKey);
    const dismissedSet = dismissed ? new Set<string>(JSON.parse(dismissed)) : new Set<string>();
    setDismissedIds(dismissedSet);

    // Filtrar avisos não visualizados
    const unviewedNotices = notices.filter((n) => {
      if (n.show_once_per_session && dismissedSet.has(n.id)) {
        return false;
      }
      return true;
    });

    if (unviewedNotices.length > 0) {
      // Encontrar o índice do primeiro aviso não visualizado
      const firstUnviewedIndex = notices.findIndex(
        (n) => !n.show_once_per_session || !dismissedSet.has(n.id)
      );
      if (firstUnviewedIndex >= 0) {
        setCurrentIndex(firstUnviewedIndex);
        setOpen(true);
      }
    }
  }, [notices]);

  const currentNotice = notices[currentIndex];

  const handleDismiss = () => {
    if (!currentNotice) return;

    // Marcar como visualizado na sessão
    if (currentNotice.show_once_per_session) {
      const sessionKey = "popup_notices_dismissed";
      const newDismissed = new Set(dismissedIds);
      newDismissed.add(currentNotice.id);
      setDismissedIds(newDismissed);
      sessionStorage.setItem(sessionKey, JSON.stringify([...newDismissed]));
    }

    // Verificar se há mais avisos para mostrar
    let nextIndex = currentIndex + 1;
    while (nextIndex < notices.length) {
      const nextNotice = notices[nextIndex];
      if (!nextNotice.show_once_per_session || !dismissedIds.has(nextNotice.id)) {
        setCurrentIndex(nextIndex);
        return;
      }
      nextIndex++;
    }

    // Não há mais avisos
    setOpen(false);
  };

  const handleButtonClick = () => {
    handleDismiss();
    
    if (currentNotice?.button_link) {
      // Se o link é interno (começa com /), usar navegação do React Router
      if (currentNotice.button_link.startsWith("/")) {
        navigate(currentNotice.button_link);
      } else {
        window.open(currentNotice.button_link, "_blank");
      }
    } else {
      // Se não tem link configurado, navegar para a página de agendamento
      navigate("/app/agendar");
    }
  };

  if (!currentNotice) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        {currentNotice.image_url && (
          <div className="w-full">
            <img
              src={currentNotice.image_url}
              alt={currentNotice.title}
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">
              {currentNotice.title}
            </h2>
            {currentNotice.message && (
              <p className="text-gray-600 whitespace-pre-wrap">
                {currentNotice.message}
              </p>
            )}
          </div>

          {/* Button */}
          <Button
            onClick={handleButtonClick}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            {currentNotice.button_text || "Entendi"}
          </Button>

          {/* Indicators for multiple notices */}
          {notices.length > 1 && (
            <div className="flex justify-center gap-1.5 pt-2">
              {notices.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex
                      ? "bg-emerald-600"
                      : dismissedIds.has(notices[index]?.id)
                      ? "bg-gray-200"
                      : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
