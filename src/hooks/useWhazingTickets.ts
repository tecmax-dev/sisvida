import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

export interface WhazingTicket {
  id: string;
  ticket_id: string;
  contact_number: string;
  contact_name: string | null;
  status: string;
  queue_id: string | null;
  user_id_whazing: string | null;
  subject: string | null;
  last_message: string | null;
  opened_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  holiday_notified: boolean;
  holiday_notified_at: string | null;
  bot_active: boolean;
}

export interface WhazingMessage {
  id: string;
  ticket_id: string;
  message_id: string | null;
  body: string | null;
  from_me: boolean;
  media_type: string | null;
  media_url: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  status: string | null;
  timestamp: number | null;
  created_at: string;
}

async function fetchTickets(statusFilter?: string): Promise<WhazingTicket[]> {
  const { data, error } = await supabase.rpc('get_whazing_tickets_for_clinic' as any, {
    p_clinic_id: SINDICATO_CLINIC_ID,
  });

  if (error) throw error;

  let tickets = (data || []) as WhazingTicket[];

  if (statusFilter === "chatbot") {
    tickets = tickets.filter(t => t.bot_active && t.status !== "closed");
  } else if (statusFilter && statusFilter !== "all") {
    tickets = tickets.filter(t => t.status === statusFilter);
  }

  return tickets;
}

export function useWhazingTickets(statusFilter?: string) {
  return useQuery({
    queryKey: ["whazing-tickets", statusFilter],
    queryFn: () => fetchTickets(statusFilter),
    refetchInterval: 15000,
  });
}

export function useWhazingTicketStats() {
  return useQuery({
    queryKey: ["whazing-ticket-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_whazing_tickets_for_clinic' as any, {
        p_clinic_id: SINDICATO_CLINIC_ID,
      });

      if (error) throw error;

      const tickets = (data || []) as { status: string }[];
      return {
        total: tickets.length,
        open: tickets.filter((t) => t.status === "open").length,
        pending: tickets.filter((t) => t.status === "pending").length,
        closed: tickets.filter((t) => t.status === "closed").length,
      };
    },
    refetchInterval: 15000,
  });
}

export function useWhazingMessages(ticketId: string | null) {
  return useQuery({
    queryKey: ["whazing-messages", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase.rpc('get_whazing_messages_for_ticket' as any, {
        p_ticket_id: ticketId,
        p_clinic_id: SINDICATO_CLINIC_ID,
      });

      if (error) throw error;
      return (data || []) as WhazingMessage[];
    },
    enabled: !!ticketId,
    refetchInterval: 5000,
  });
}

// Realtime hook for ticket updates
export function useWhazingRealtimeSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('whazing-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whazing_tickets' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whazing-tickets"] });
          queryClient.invalidateQueries({ queryKey: ["whazing-ticket-stats"] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whazing_messages' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whazing-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

// Hook for pending ticket count (for sidebar badge)
export function useWhazingPendingCount() {
  return useQuery({
    queryKey: ["whazing-pending-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_whazing_tickets_for_clinic' as any, {
        p_clinic_id: SINDICATO_CLINIC_ID,
      });

      if (error) throw error;
      const tickets = (data || []) as WhazingTicket[];
      return tickets.filter(t => t.status === "open" || t.status === "pending").length;
    },
    refetchInterval: 15000,
  });
}

// Send message action
export async function sendWhazingMessage(ticketId: string, message: string, contactNumber: string) {
  const { data, error } = await supabase.functions.invoke('whazing-actions', {
    body: { action: 'send_message', ticketId, message, contactNumber },
  });
  if (error) throw error;
  return data;
}

// Send media/attachment action
export async function sendWhazingMedia(
  ticketId: string,
  contactNumber: string,
  file: File,
  caption?: string
) {
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const mediatype = file.type.startsWith('image/') ? 'image' : 'document';

  const { data, error } = await supabase.functions.invoke('whazing-actions', {
    body: {
      action: 'send_media',
      ticketId,
      contactNumber,
      media: base64,
      mimetype: file.type,
      fileName: file.name,
      mediatype,
      caption: caption || '',
    },
  });
  if (error) throw error;
  return data;
}

// Close ticket action
export async function closeWhazingTicket(ticketId: string, contactNumber?: string) {
  const { data, error } = await supabase.functions.invoke('whazing-actions', {
    body: { action: 'close_ticket', ticketId, contactNumber },
  });
  if (error) throw error;
  return data;
}

// Reopen ticket action
export async function reopenWhazingTicket(ticketId: string, contactNumber?: string) {
  const { data, error } = await supabase.functions.invoke('whazing-actions', {
    body: { action: 'reopen_ticket', ticketId, contactNumber },
  });
  if (error) throw error;
  return data;
}

// Transfer ticket to queue
export async function transferWhazingTicketToQueue(ticketId: string, queueId: string) {
  const { data, error } = await supabase.functions.invoke('whazing-actions', {
    body: { action: 'transfer_queue', ticketId, queueId },
  });
  if (error) throw error;
  return data;
}

// Transfer ticket to user
export async function transferWhazingTicketToUser(ticketId: string, userId: string) {
  const { data, error } = await supabase.functions.invoke('whazing-actions', {
    body: { action: 'transfer_user', ticketId, userId },
  });
  if (error) throw error;
  return data;
}

// Assume ticket - disable bot
export async function assumeWhazingTicket(ticketId: string) {
  const { data, error } = await supabase.functions.invoke('whazing-actions', {
    body: { action: 'assume_ticket', ticketId },
  });
  if (error) throw error;
  return data;
}

// Return ticket to bot
export async function returnWhazingTicketToBot(ticketId: string, contactNumber: string) {
  const { data, error } = await supabase.functions.invoke('whazing-actions', {
    body: { action: 'return_to_bot', ticketId, contactNumber },
  });
  if (error) throw error;
  return data;
}
