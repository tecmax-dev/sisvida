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

export function useCreateQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string; description?: string }) => {
      const { error } = await (supabase as any)
        .from("whazing_queues")
        .insert({ name: input.name, color: input.color, description: input.description || null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whazing-queues"] });
    },
  });
}

export function useUpdateQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; color?: string; description?: string; is_active?: boolean }) => {
      const { error } = await (supabase as any)
        .from("whazing_queues")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whazing-queues"] });
    },
  });
}

export function useDeleteQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("whazing_queues")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whazing-queues"] });
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
