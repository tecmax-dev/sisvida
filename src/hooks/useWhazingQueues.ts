import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhazingQueue {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export function useWhazingQueues() {
  return useQuery({
    queryKey: ["whazing-queues"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whazing_queues")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as WhazingQueue[];
    },
  });
}

export function useTransferToQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, queueId }: { ticketId: string; queueId: string }) => {
      const { data, error } = await supabase.functions.invoke('whazing-actions', {
        body: { action: 'transfer_queue', ticketId, queueId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whazing-tickets"] });
      qc.invalidateQueries({ queryKey: ["whazing-ticket-stats"] });
    },
  });
}
