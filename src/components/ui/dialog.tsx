import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { becameVisibleRecently, wasHiddenRecently, isTabInactive } from "@/lib/visibility-grace";

const Dialog = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) => {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState<boolean>(defaultOpen ?? false);

  const open = isControlled ? openProp : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      // Prevent unintended close events when switching browser tabs or losing focus.
      if (!nextOpen) {
        if (isTabInactive() || becameVisibleRecently(1500) || wasHiddenRecently(1500)) {
          return;
        }
      }

      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return <DialogPrimitive.Root {...props} open={open} onOpenChange={handleOpenChange} />;
};
const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onFocusOutside, onInteractOutside, onPointerDownOutside, onEscapeKeyDown, ...props }, ref) => (
  <DialogPortal forceMount>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      {...props}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
      )}
      onFocusOutside={(e) => {
        // ALWAYS prevent focus-based dismissal - only allow explicit user actions
        if (isTabInactive() || becameVisibleRecently(1500) || wasHiddenRecently(1500)) {
          e.preventDefault();
          return;
        }
        // Still prevent by default but allow custom handler
        e.preventDefault();
        onFocusOutside?.(e);
      }}
      onInteractOutside={(e) => {
        // Block all interactions when tab is inactive or transitioning
        if (isTabInactive() || becameVisibleRecently(1500) || wasHiddenRecently(1500)) {
          e.preventDefault();
          return;
        }
        // Block focus-related events entirely
        const originalEvent = e.detail?.originalEvent;
        if (
          originalEvent instanceof FocusEvent || 
          originalEvent?.type === "focusout" || 
          originalEvent?.type === "blur" ||
          originalEvent?.type === "focus"
        ) {
          e.preventDefault();
          return;
        }
        // Allow pointer-based interactions (user clicking outside)
        onInteractOutside?.(e);
      }}
      onPointerDownOutside={(e) => {
        if (isTabInactive() || becameVisibleRecently(1500) || wasHiddenRecently(1500)) {
          e.preventDefault();
          return;
        }
        onPointerDownOutside?.(e);
      }}
      onEscapeKeyDown={(e) => {
        if (isTabInactive() || becameVisibleRecently(1500) || wasHiddenRecently(1500)) {
          e.preventDefault();
          return;
        }
        onEscapeKeyDown?.(e);
      }}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
