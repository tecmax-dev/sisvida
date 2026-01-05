import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/utils";

const HoverCard = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root>) => {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState<boolean>(defaultOpen ?? false);

  const open = isControlled ? openProp : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && (document.hidden || document.visibilityState === "hidden" || !document.hasFocus())) {
        return;
      }

      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return <HoverCardPrimitive.Root {...props} open={open} onOpenChange={handleOpenChange} />;
};

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, onFocusOutside, onInteractOutside, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    onFocusOutside={(e) => {
      if (document.hidden || document.visibilityState === 'hidden') {
        e.preventDefault();
        return;
      }
      onFocusOutside?.(e);
    }}
    onInteractOutside={(e) => {
      if (document.hidden || document.visibilityState === 'hidden') {
        e.preventDefault();
        return;
      }
      const originalEvent = e.detail?.originalEvent;
      if (originalEvent instanceof FocusEvent || 
          originalEvent?.type === 'focusout' || 
          originalEvent?.type === 'blur') {
        e.preventDefault();
        return;
      }
      onInteractOutside?.(e);
    }}
    {...props}
  />
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };
