import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhazingTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface WhazingTicketTag {
  id: string;
  ticket_id: string;
  tag_id: string;
  created_at: string;
}

export function useWhazingTags() {
  return useQuery({
    queryKey: ["whazing-tags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whazing_tags")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as WhazingTag[];
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { data, error } = await (supabase as any)
        .from("whazing_tags")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whazing-tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("whazing_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whazing-tags"] });
      qc.invalidateQueries({ queryKey: ["whazing-ticket-tags"] });
    },
  });
}

export function useTicketTags(ticketId: string | null) {
  return useQuery({
    queryKey: ["whazing-ticket-tags", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await (supabase as any)
        .from("whazing_ticket_tags")
        .select("*, tag:whazing_tags(*)")
        .eq("ticket_id", ticketId);
      if (error) throw error;
      return (data || []) as (WhazingTicketTag & { tag: WhazingTag })[];
    },
    enabled: !!ticketId,
  });
}

export function useAddTicketTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, tagId }: { ticketId: string; tagId: string }) => {
      const { error } = await (supabase as any)
        .from("whazing_ticket_tags")
        .insert({ ticket_id: ticketId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whazing-ticket-tags"] }),
  });
}

export function useRemoveTicketTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, tagId }: { ticketId: string; tagId: string }) => {
      const { error } = await (supabase as any)
        .from("whazing_ticket_tags")
        .delete()
        .eq("ticket_id", ticketId)
        .eq("tag_id", tagId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whazing-ticket-tags"] }),
  });
}
