import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TableName = 
  | "patients"
  | "appointments"
  | "professionals"
  | "procedures"
  | "medical_records"
  | "prescriptions"
  | "financial_transactions"
  | "insurance_plans"
  | "anamnese_templates"
  | "anamnese_responses"
  | "waiting_list_entries"
  | "birthday_message_logs"
  | "message_logs"
  | "homologacao_appointments";

interface UseRealtimeSubscriptionOptions {
  table: TableName;
  filter?: {
    column: string;
    value: string;
  };
  onInsert?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  showToast?: boolean;
  toastMessages?: {
    insert?: string;
    update?: string;
    delete?: string;
  };
  enabled?: boolean;
}

export function useRealtimeSubscription({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  showToast = true,
  toastMessages,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribed = useRef(false);

  const defaultMessages: Record<TableName, { insert: string; update: string; delete: string }> = {
    patients: {
      insert: "Novo paciente cadastrado",
      update: "Dados do paciente atualizados",
      delete: "Paciente removido",
    },
    appointments: {
      insert: "Novo agendamento criado",
      update: "Agendamento atualizado",
      delete: "Agendamento removido",
    },
    professionals: {
      insert: "Novo profissional cadastrado",
      update: "Profissional atualizado",
      delete: "Profissional removido",
    },
    procedures: {
      insert: "Novo procedimento criado",
      update: "Procedimento atualizado",
      delete: "Procedimento removido",
    },
    medical_records: {
      insert: "Novo prontuário criado",
      update: "Prontuário atualizado",
      delete: "Prontuário removido",
    },
    prescriptions: {
      insert: "Nova receita criada",
      update: "Receita atualizada",
      delete: "Receita removida",
    },
    financial_transactions: {
      insert: "Nova transação registrada",
      update: "Transação atualizada",
      delete: "Transação removida",
    },
    insurance_plans: {
      insert: "Novo convênio cadastrado",
      update: "Convênio atualizado",
      delete: "Convênio removido",
    },
    anamnese_templates: {
      insert: "Novo modelo de anamnese criado",
      update: "Modelo de anamnese atualizado",
      delete: "Modelo de anamnese removido",
    },
    anamnese_responses: {
      insert: "Nova anamnese preenchida",
      update: "Anamnese atualizada",
      delete: "Anamnese removida",
    },
    waiting_list_entries: {
      insert: "Paciente adicionado à lista de espera",
      update: "Lista de espera atualizada",
      delete: "Paciente removido da lista de espera",
    },
    birthday_message_logs: {
      insert: "Mensagem de aniversário enviada",
      update: "Registro atualizado",
      delete: "Registro removido",
    },
    message_logs: {
      insert: "Nova mensagem enviada",
      update: "Registro atualizado",
      delete: "Registro removido",
    },
    homologacao_appointments: {
      insert: "Novo agendamento de homologação",
      update: "Agendamento de homologação atualizado",
      delete: "Agendamento de homologação removido",
    },
  };

  const messages = toastMessages || defaultMessages[table];

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isSubscribed.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    const channelName = filter 
      ? `realtime-${table}-${filter.column}-${filter.value}` 
      : `realtime-${table}`;

    const filterString = filter 
      ? `${filter.column}=eq.${filter.value}` 
      : undefined;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: filterString,
        },
        (payload) => {
          console.log(`[Realtime] INSERT on ${table}:`, payload);
          if (showToast && messages.insert) {
            toast({
              title: messages.insert,
              description: "A página foi atualizada automaticamente.",
            });
          }
          onInsert?.(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter: filterString,
        },
        (payload) => {
          console.log(`[Realtime] UPDATE on ${table}:`, payload);
          if (showToast && messages.update) {
            toast({
              title: messages.update,
              description: "A página foi atualizada automaticamente.",
            });
          }
          onUpdate?.(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table,
          filter: filterString,
        },
        (payload) => {
          console.log(`[Realtime] DELETE on ${table}:`, payload);
          if (showToast && messages.delete) {
            toast({
              title: messages.delete,
              description: "A página foi atualizada automaticamente.",
            });
          }
          onDelete?.(payload);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status for ${table}:`, status);
        isSubscribed.current = status === "SUBSCRIBED";
      });

    return cleanup;
  }, [table, filter?.column, filter?.value, enabled, cleanup]);

  return {
    isSubscribed: isSubscribed.current,
    cleanup,
  };
}
