import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

export interface QueueUser {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  queue_id: string;
  created_at: string;
}

export interface AvailableUser {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
}

export interface UserQueue {
  queue_id: string;
  queue_name: string;
  queue_color: string;
}

export function useQueueUsers(queueId: string | null) {
  return useQuery({
    queryKey: ["queue-users", queueId],
    queryFn: async () => {
      if (!queueId) return [];
      const { data, error } = await supabase.rpc("get_queue_users" as any, {
        p_queue_id: queueId,
      });
      if (error) throw error;
      return (data || []) as QueueUser[];
    },
    enabled: !!queueId,
  });
}

export function useAvailableUsersForQueue() {
  return useQuery({
    queryKey: ["available-users-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_users_for_queue" as any, {
        p_clinic_id: SINDICATO_CLINIC_ID,
      });
      if (error) throw error;
      return (data || []) as AvailableUser[];
    },
  });
}

export function useCurrentUserQueues(userId: string | null) {
  return useQuery({
    queryKey: ["user-queues", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.rpc("get_user_queues" as any, {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data || []) as UserQueue[];
    },
    enabled: !!userId,
  });
}

export function useAddUserToQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ queueId, userId }: { queueId: string; userId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("whazing_queue_users")
        .insert({ queue_id: queueId, user_id: userId, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: (_, { queueId }) => {
      qc.invalidateQueries({ queryKey: ["queue-users", queueId] });
      qc.invalidateQueries({ queryKey: ["user-queues"] });
    },
  });
}

export function useRemoveUserFromQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, queueId }: { assignmentId: string; queueId: string }) => {
      const { error } = await (supabase as any)
        .from("whazing_queue_users")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
      return queueId;
    },
    onSuccess: (queueId) => {
      qc.invalidateQueries({ queryKey: ["queue-users", queueId] });
      qc.invalidateQueries({ queryKey: ["user-queues"] });
    },
  });
}
