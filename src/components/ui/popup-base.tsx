import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PopupBaseProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  full: "max-w-full",
};

export function PopupBase({
  open,
  onClose,
  children,
  className,
  title,
  description,
  showCloseButton = true,
  closeOnOverlayClick = true,
  maxWidth = "lg",
}: PopupBaseProps) {
  // Don't render anything if not open
  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  React.useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when popup is open
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
      onClick={handleOverlayClick}
    >
      <div
        className={cn(
          "relative w-full bg-background border rounded-lg shadow-lg p-6 mx-4 max-h-[90vh] overflow-y-auto",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          maxWidthClasses[maxWidth],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </button>
        )}

        {/* Header */}
        {(title || description) && (
          <div className="mb-4 pr-8">
            {title && (
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-1.5">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// Header component for custom headers
interface PopupHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function PopupHeader({ children, className }: PopupHeaderProps) {
  return (
    <div className={cn("mb-4 pr-8", className)}>
      {children}
    </div>
  );
}

// Title component
interface PopupTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function PopupTitle({ children, className }: PopupTitleProps) {
  return (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
      {children}
    </h2>
  );
}

// Description component
interface PopupDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function PopupDescription({ children, className }: PopupDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted-foreground mt-1.5", className)}>
      {children}
    </p>
  );
}

// Footer component for action buttons
interface PopupFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function PopupFooter({ children, className }: PopupFooterProps) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)}>
      {children}
    </div>
  );
}
