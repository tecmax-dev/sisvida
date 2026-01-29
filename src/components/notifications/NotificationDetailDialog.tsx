import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Wrench, CreditCard, Sparkles, AlertTriangle, Info, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: {
    title: string;
    message?: string;
    body?: string;
    type?: string;
    created_at?: string;
    scheduled_at?: string;
  } | null;
}

const typeConfig = {
  maintenance: { icon: Wrench, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-950" },
  billing: { icon: CreditCard, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-950" },
  feature: { icon: Sparkles, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-950" },
  alert: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-950" },
  info: { icon: Info, color: "text-green-500", bg: "bg-green-100 dark:bg-green-950" },
  default: { icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-950" },
};

export function NotificationDetailDialog({
  open,
  onOpenChange,
  notification,
}: NotificationDetailDialogProps) {
  if (!notification) return null;

  const type = notification.type as keyof typeof typeConfig;
  const config = typeConfig[type] || typeConfig.default;
  const TypeIcon = config.icon;
  const content = notification.message || notification.body || "";
  const dateStr = notification.scheduled_at || notification.created_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-full shrink-0", config.bg)}>
              <TypeIcon className={cn("h-5 w-5", config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold leading-tight">
                {notification.title}
              </DialogTitle>
              {dateStr && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(dateStr), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="mt-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {content}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
