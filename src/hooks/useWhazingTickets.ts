import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
}

export function useWhazingTickets(statusFilter?: string) {
  return useQuery({
    queryKey: ["whazing-tickets", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("whazing_tickets" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as WhazingTicket[];
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });
}

export function useWhazingTicketStats() {
  return useQuery({
    queryKey: ["whazing-ticket-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whazing_tickets" as any)
        .select("status");

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
