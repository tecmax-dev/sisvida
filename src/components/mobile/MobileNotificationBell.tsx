import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, MessageSquare, Wrench, CreditCard, Sparkles, AlertTriangle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { NotificationDetailDialog } from "@/components/notifications/NotificationDetailDialog";

interface UnifiedNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  source: "patient" | "system";
}

// Type icon mapping for system notifications
const systemTypeIcons: Record<string, typeof Bell> = {
  maintenance: Wrench,
  billing: CreditCard,
  feature: Sparkles,
  alert: AlertTriangle,
  info: Info,
};

// Notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator1.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator1.type = 'sine';
    oscillator2.frequency.setValueAtTime(1318.5, audioContext.currentTime);
    oscillator2.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.5);
    oscillator2.stop(audioContext.currentTime + 0.5);
    
    setTimeout(() => {
      audioContext.close();
    }, 600);
  } catch (error) {
    console.log('Could not play notification sound:', error);
  }
};

export function MobileNotificationBell() {
  const { patientId, clinicId } = useMobileAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<UnifiedNotification | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const previousUnreadCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);
  // Track which system notifications have been read locally (since there's no per-patient read tracking for system_notifications in PWA)
  const [readSystemIds, setReadSystemIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("read_system_notifications");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Fetch patient notifications using RPC
  const { data: patientNotifications = [], error: patientError } = useQuery({
    queryKey: ["patient-notifications", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .rpc("get_patient_notifications", { p_patient_id: patientId });
      if (error) throw error;
      return (data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type || "info",
        is_read: n.is_read,
        created_at: n.created_at,
        source: "patient" as const,
      }));
    },
    enabled: !!patientId,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Fetch system notifications (global, from admin panel)
  const { data: systemNotifications = [], error: systemError } = useQuery({
    queryKey: ["system-notifications-mobile"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("system_notifications")
        .select("id, title, message, type, priority, scheduled_at, created_at, expires_at")
        .eq("is_active", true)
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return (data || []).map((n: any) => ({
        id: `sys_${n.id}`,
        title: n.title,
        body: n.message,
        type: n.type || "info",
        is_read: readSystemIds.has(n.id),
        created_at: n.scheduled_at || n.created_at,
        source: "system" as const,
        _originalId: n.id,
      }));
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Merge and sort all notifications
  const notifications: UnifiedNotification[] = [
    ...patientNotifications,
    ...systemNotifications,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  useEffect(() => {
    if (patientError) console.error("[MobileNotificationBell] Patient query error:", patientError);
    if (systemError) console.error("[MobileNotificationBell] System query error:", systemError);
  }, [patientError, systemError]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Play sound when new unread notifications arrive
  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      previousUnreadCountRef.current = unreadCount;
      return;
    }

    if (unreadCount > previousUnreadCountRef.current) {
      playNotificationSound();
    }
    
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // Realtime for patient_notifications
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel(`patient-notifications-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "patient_notifications",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          console.log("[MobileNotificationBell] New patient notification:", payload);
          playNotificationSound();
          queryClient.invalidateQueries({ queryKey: ["patient-notifications", patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  // Realtime for system_notifications
  useEffect(() => {
    const channel = supabase
      .channel("system-notifications-mobile-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_notifications",
        },
        (payload) => {
          console.log("[MobileNotificationBell] System notification change:", payload);
          if (payload.eventType === "INSERT") {
            playNotificationSound();
          }
          queryClient.invalidateQueries({ queryKey: ["system-notifications-mobile"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mark patient notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!patientId) throw new Error("No patient ID");
      const { error } = await supabase
        .rpc("mark_notification_read", { 
          p_notification_id: notificationId,
          p_patient_id: patientId 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notifications", patientId] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      // Mark patient notifications
      if (patientId) {
        const { error } = await supabase
          .rpc("mark_all_notifications_read", { p_patient_id: patientId });
        if (error) throw error;
      }
      
      // Mark system notifications locally
      const newReadIds = new Set(readSystemIds);
      systemNotifications.forEach((n: any) => {
        newReadIds.add(n._originalId || n.id.replace("sys_", ""));
      });
      setReadSystemIds(newReadIds);
      localStorage.setItem("read_system_notifications", JSON.stringify([...newReadIds]));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notifications", patientId] });
      queryClient.invalidateQueries({ queryKey: ["system-notifications-mobile"] });
    },
  });

  const hasUnread = unreadCount > 0;

  const handleNotificationClick = (notification: UnifiedNotification) => {
    if (!notification.is_read) {
      if (notification.source === "patient") {
        markAsReadMutation.mutate(notification.id);
      } else {
        // Mark system notification as read locally
        const originalId = notification.id.replace("sys_", "");
        const newReadIds = new Set(readSystemIds);
        newReadIds.add(originalId);
        setReadSystemIds(newReadIds);
        localStorage.setItem("read_system_notifications", JSON.stringify([...newReadIds]));
        queryClient.invalidateQueries({ queryKey: ["system-notifications-mobile"] });
      }
    }
    setSelectedNotification(notification);
    setDetailDialogOpen(true);
  };

  // If no patientId and no system notifications, show disabled bell
  if (!patientId && systemNotifications.length === 0) {
    return (
      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
        <Bell className="h-6 w-6" />
      </Button>
    );
  }

  const getNotificationIcon = (notification: UnifiedNotification) => {
    if (notification.source === "system") {
      const Icon = systemTypeIcons[notification.type] || Info;
      return Icon;
    }
    return MessageSquare;
  };

  return (
    <>
      <NotificationDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        notification={selectedNotification ? {
          title: selectedNotification.title,
          body: selectedNotification.body,
          type: selectedNotification.type,
          created_at: selectedNotification.created_at,
        } : null}
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative text-white hover:bg-white/10",
            hasUnread && "animate-pulse"
          )}
        >
          <Bell
            className={cn(
              "h-6 w-6 transition-all",
              hasUnread && "animate-[shake_0.5s_ease-in-out]"
            )}
          />
          {hasUnread && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white border-0"
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
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification);
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 cursor-pointer transition-colors hover:bg-muted/50",
                      !notification.is_read && "bg-emerald-50 dark:bg-emerald-950/20"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "p-2 rounded-full shrink-0",
                        notification.source === "system"
                          ? "bg-blue-100 dark:bg-blue-900"
                          : "bg-emerald-100 dark:bg-emerald-900"
                      )}>
                        <Icon className={cn(
                          "h-4 w-4",
                          notification.source === "system"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm truncate",
                              !notification.is_read ? "font-semibold" : "font-medium"
                            )}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="h-2 w-2 bg-emerald-500 rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.body}
                        </p>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 inline-block">
                          Ler mais →
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
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
