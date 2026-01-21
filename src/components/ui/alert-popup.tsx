import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AlertPopupProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  isLoading?: boolean;
  disabled?: boolean;
}

export function AlertPopup({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmVariant = "default",
  isLoading = false,
  disabled = false,
}: AlertPopupProps) {
  // Don't render anything if not open
  if (!open) return null;

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  React.useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
    >
      <div
        className={cn(
          "relative w-full max-w-lg bg-background border rounded-lg shadow-lg p-6 mx-4",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-2">
              {description}
            </p>
          )}
        </div>

        {/* Custom content */}
        {children}

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={disabled || isLoading}
          >
            {isLoading ? "Aguarde..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
