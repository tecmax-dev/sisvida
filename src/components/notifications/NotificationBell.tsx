import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Wrench, CreditCard, Sparkles, AlertTriangle, Info, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { NotificationDetailDialog } from "./NotificationDetailDialog";

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: "maintenance" | "billing" | "feature" | "alert" | "info";
  priority: "low" | "medium" | "high" | "urgent";
  scheduled_at: string;
  created_at: string;
}

interface NotificationRead {
  notification_id: string;
}

const typeConfig = {
  maintenance: { icon: Wrench, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-950" },
  billing: { icon: CreditCard, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-950" },
  feature: { icon: Sparkles, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-950" },
  alert: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-950" },
  info: { icon: Info, color: "text-green-500", bg: "bg-green-100 dark:bg-green-950" },
};

const priorityColors = {
  low: "border-l-gray-400",
  medium: "border-l-yellow-500",
  high: "border-l-orange-500",
  urgent: "border-l-red-500",
};

export default function NotificationBell() {
  const { user, currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<SystemNotification | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["user-notifications", currentClinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_notifications")
        .select("id, title, message, type, priority, scheduled_at, created_at")
        .order("scheduled_at", { ascending: false });
      
      if (error) throw error;
      return data as SystemNotification[];
    },
    enabled: !!user && !!currentClinic,
  });

  // Fetch read status
  const { data: readNotifications = [] } = useQuery({
    queryKey: ["notification-reads", currentClinic?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_notification_reads")
        .select("notification_id")
        .eq("clinic_id", currentClinic!.id)
        .eq("user_id", user!.id);
      
      if (error) throw error;
      return data as NotificationRead[];
    },
    enabled: !!user && !!currentClinic,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!currentClinic) return;

    const channel = supabase
      .channel("system-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_notifications",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClinic, queryClient]);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.from("clinic_notification_reads").insert({
        notification_id: notificationId,
        clinic_id: currentClinic!.id,
        user_id: user!.id,
      });
      if (error && error.code !== "23505") throw error; // Ignore duplicate key errors
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-reads"] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications
        .filter((n) => !readNotifications.some((r) => r.notification_id === n.id))
        .map((n) => n.id);

      if (unreadIds.length === 0) return;

      const inserts = unreadIds.map((id) => ({
        notification_id: id,
        clinic_id: currentClinic!.id,
        user_id: user!.id,
      }));

      const { error } = await supabase
        .from("clinic_notification_reads")
        .upsert(inserts, { onConflict: "notification_id,clinic_id,user_id" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-reads"] });
    },
  });

  const readIds = new Set(readNotifications.map((r) => r.notification_id));
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const hasUnread = unreadCount > 0;

  const handleNotificationClick = (notification: SystemNotification) => {
    if (!readIds.has(notification.id)) {
      markAsReadMutation.mutate(notification.id);
    }
    setSelectedNotification(notification);
    setDetailDialogOpen(true);
  };

  return (
    <>
      <NotificationDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        notification={selectedNotification}
      />
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative",
            hasUnread && "animate-pulse"
          )}
        >
          <Bell
            className={cn(
              "h-5 w-5 transition-all",
              hasUnread && "animate-[shake_0.5s_ease-in-out_infinite]"
            )}
          />
          {hasUnread && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white animate-bounce"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificações</h4>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              <Check className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const TypeIcon = typeConfig[notification.type].icon;
                const isRead = readIds.has(notification.id);

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 cursor-pointer transition-colors hover:bg-muted/50 border-l-4",
                      priorityColors[notification.priority],
                      !isRead && "bg-muted/30"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-full shrink-0",
                          typeConfig[notification.type].bg
                        )}
                      >
                        <TypeIcon
                          className={cn("h-4 w-4", typeConfig[notification.type].color)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              !isRead && "font-semibold"
                            )}
                          >
                            {notification.title}
                          </p>
                          {!isRead && (
                            <span className="h-2 w-2 bg-primary rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <span className="text-xs text-primary/70 hover:text-primary font-medium mt-1 inline-block">
                          Ler mais →
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.scheduled_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
    </>
  );
}
