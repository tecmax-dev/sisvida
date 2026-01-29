import { useState, useEffect, useRef, useCallback } from "react";
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
import { Bell, Check, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PatientNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// Notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a pleasant notification chime
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // First tone
    oscillator1.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator1.type = 'sine';
    
    // Second tone (harmony)
    oscillator2.frequency.setValueAtTime(1318.5, audioContext.currentTime); // E6
    oscillator2.type = 'sine';
    
    // Envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.5);
    oscillator2.stop(audioContext.currentTime + 0.5);
    
    // Cleanup
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
  const previousUnreadCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);

  // Fetch notifications for this patient
  const { data: notifications = [] } = useQuery({
    queryKey: ["patient-notifications", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      
      const { data, error } = await supabase
        .from("patient_notifications")
        .select("id, title, body, type, data, is_read, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) {
        console.error("Error fetching patient notifications:", error);
        return [];
      }
      return data as PatientNotification[];
    },
    enabled: !!patientId,
    refetchInterval: 30000,
  });

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

  // Subscribe to realtime updates and play sound
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
          console.log("New notification received:", payload);
          playNotificationSound();
          queryClient.invalidateQueries({ queryKey: ["patient-notifications", patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("patient_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notifications", patientId] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications
        .filter((n) => !n.is_read)
        .map((n) => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("patient_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", unreadIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notifications", patientId] });
    },
  });

  const hasUnread = unreadCount > 0;

  const handleNotificationClick = (notification: PatientNotification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  if (!patientId) {
    return (
      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
        <Bell className="h-6 w-6" />
      </Button>
    );
  }

  return (
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
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 cursor-pointer transition-colors hover:bg-muted/50",
                    !notification.is_read && "bg-emerald-50 dark:bg-emerald-950/20"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900 shrink-0">
                      <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
