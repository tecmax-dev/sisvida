import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhazingQuickResponse {
  id: string;
  title: string;
  shortcut: string | null;
  body: string;
  media_url: string | null;
  media_type: string | null;
  category: string | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export function useWhazingQuickResponses() {
  return useQuery({
    queryKey: ["whazing-quick-responses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whazing_quick_responses")
        .select("*")
        .eq("is_active", true)
        .order("usage_count", { ascending: false });
      if (error) throw error;
      return (data || []) as WhazingQuickResponse[];
    },
  });
}

export function useCreateQuickResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WhazingQuickResponse>) => {
      const { data, error } = await (supabase as any)
        .from("whazing_quick_responses")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whazing-quick-responses"] }),
  });
}

export function useUpdateQuickResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<WhazingQuickResponse> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("whazing_quick_responses")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whazing-quick-responses"] }),
  });
}

export function useDeleteQuickResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("whazing_quick_responses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whazing-quick-responses"] }),
  });
}

export function useIncrementQuickResponseUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Get current count then increment
      const { data: current } = await (supabase as any)
        .from("whazing_quick_responses")
        .select("usage_count")
        .eq("id", id)
        .single();
      const { error } = await (supabase as any)
        .from("whazing_quick_responses")
        .update({ usage_count: (current?.usage_count || 0) + 1 })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whazing-quick-responses"] }),
  });
}
