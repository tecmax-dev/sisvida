import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type {
  WhatsAppTicket,
  WhatsAppOperator,
  WhatsAppSector,
  WhatsAppTicketMessage,
  WhatsAppQuickReply,
  WhatsAppModuleSettings,
  WhatsAppTicketStatus,
  WhatsAppOperatorStatus,
} from '@/types/whatsapp-multiattendance';

// Helper to type Supabase responses for new tables not yet in types.ts
const fromTable = (table: string) => supabase.from(table as any);

export function useWhatsAppTickets(clinicId: string | undefined) {
  const [tickets, setTickets] = useState<WhatsAppTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!clinicId) return;
    
    try {
      const { data, error } = await fromTable('whatsapp_tickets')
        .select(`
          *,
          contact:whatsapp_contacts(*),
          sector:whatsapp_sectors(*),
          assigned_operator:whatsapp_operators!whatsapp_tickets_assigned_operator_id_fkey(*)
        `)
        .eq('clinic_id', clinicId)
        .neq('status', 'closed')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setTickets((data as unknown as WhatsAppTicket[]) || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Realtime subscription
  useEffect(() => {
    if (!clinicId) return;

    const channel = supabase
      .channel('whatsapp-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_tickets',
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, fetchTickets]);

  const updateTicketStatus = async (ticketId: string, status: WhatsAppTicketStatus) => {
    const updates: Record<string, any> = { status };
    
    if (status === 'closed') {
      updates.closed_at = new Date().toISOString();
    }

    const { error } = await fromTable('whatsapp_tickets')
      .update(updates)
      .eq('id', ticketId);

    if (error) {
      toast.error('Erro ao atualizar status');
      throw error;
    }
    
    toast.success('Status atualizado');
  };

  const assignTicket = async (ticketId: string, operatorId: string | null) => {
    const updates: Record<string, any> = { 
      assigned_operator_id: operatorId,
      status: operatorId ? 'open' : 'pending',
      is_bot_active: !operatorId,
    };

    if (operatorId && !tickets.find(t => t.id === ticketId)?.first_response_at) {
      updates.first_response_at = new Date().toISOString();
    }

    const { error } = await fromTable('whatsapp_tickets')
      .update(updates)
      .eq('id', ticketId);

    if (error) {
      toast.error('Erro ao assumir ticket');
      throw error;
    }
    
    toast.success(operatorId ? 'Ticket assumido' : 'Ticket liberado');
  };

  return {
    tickets,
    isLoading,
    refetch: fetchTickets,
    updateTicketStatus,
    assignTicket,
  };
}

export function useWhatsAppOperators(clinicId: string | undefined) {
  const [operators, setOperators] = useState<WhatsAppOperator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchOperators = useCallback(async () => {
    if (!clinicId) return;
    
    try {
      const { data, error } = await fromTable('whatsapp_operators')
        .select(`
          *,
          sectors:whatsapp_operator_sectors(
            sector:whatsapp_sectors(*)
          )
        `)
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      const formatted = (data || []).map((op: any) => ({
        ...op,
        sectors: op.sectors?.map((s: any) => s.sector) || [],
      }));
      
      setOperators(formatted as WhatsAppOperator[]);
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchOperators();
  }, [fetchOperators]);

  // Realtime for operator status
  useEffect(() => {
    if (!clinicId) return;

    const channel = supabase
      .channel('whatsapp-operators-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_operators',
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => {
          fetchOperators();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, fetchOperators]);

  const updateMyStatus = async (status: WhatsAppOperatorStatus) => {
    if (!user?.id || !clinicId) return;

    const { error } = await fromTable('whatsapp_operators')
      .update({ 
        status, 
        last_activity_at: new Date().toISOString() 
      })
      .eq('user_id', user.id)
      .eq('clinic_id', clinicId);

    if (error) {
      toast.error('Erro ao atualizar status');
      throw error;
    }
  };

  const currentOperator = operators.find(op => op.user_id === user?.id);

  return {
    operators,
    currentOperator,
    isLoading,
    refetch: fetchOperators,
    updateMyStatus,
  };
}

export function useWhatsAppSectors(clinicId: string | undefined) {
  const [sectors, setSectors] = useState<WhatsAppSector[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSectors = useCallback(async () => {
    if (!clinicId) return;
    
    try {
      const { data, error } = await fromTable('whatsapp_sectors')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      setSectors((data as unknown as WhatsAppSector[]) || []);
    } catch (error) {
      console.error('Error fetching sectors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchSectors();
  }, [fetchSectors]);

  const createSector = async (sector: Partial<WhatsAppSector>) => {
    const { error } = await fromTable('whatsapp_sectors')
      .insert({ ...sector, clinic_id: clinicId });

    if (error) {
      toast.error('Erro ao criar setor');
      throw error;
    }
    
    toast.success('Setor criado');
    fetchSectors();
  };

  const updateSector = async (id: string, updates: Partial<WhatsAppSector>) => {
    const { error } = await fromTable('whatsapp_sectors')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar setor');
      throw error;
    }
    
    toast.success('Setor atualizado');
    fetchSectors();
  };

  return {
    sectors,
    isLoading,
    refetch: fetchSectors,
    createSector,
    updateSector,
  };
}

export function useWhatsAppMessages(ticketId: string | undefined) {
  const [messages, setMessages] = useState<WhatsAppTicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!ticketId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    
    try {
      const { data, error } = await fromTable('whatsapp_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as unknown as WhatsAppTicketMessage[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime for new messages
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as WhatsAppTicketMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  const sendMessage = async (message: string, operatorId: string, operatorName: string) => {
    if (!ticketId) return;

    const { error } = await fromTable('whatsapp_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_type: 'operator',
        sender_id: operatorId,
        sender_name: operatorName,
        message,
        message_type: 'text',
        is_from_me: true,
      });

    if (error) {
      toast.error('Erro ao enviar mensagem');
      throw error;
    }

    // Update ticket last_message_at
    await fromTable('whatsapp_tickets')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', ticketId);
  };

  return {
    messages,
    isLoading,
    refetch: fetchMessages,
    sendMessage,
  };
}

export function useWhatsAppQuickReplies(clinicId: string | undefined) {
  const [quickReplies, setQuickReplies] = useState<WhatsAppQuickReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuickReplies = useCallback(async () => {
    if (!clinicId) return;
    
    try {
      const { data, error } = await fromTable('whatsapp_quick_replies')
        .select(`
          *,
          sector:whatsapp_sectors(*)
        `)
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('title');

      if (error) throw error;
      setQuickReplies((data as unknown as WhatsAppQuickReply[]) || []);
    } catch (error) {
      console.error('Error fetching quick replies:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchQuickReplies();
  }, [fetchQuickReplies]);

  return {
    quickReplies,
    isLoading,
    refetch: fetchQuickReplies,
  };
}

export function useWhatsAppModuleSettings(clinicId: string | undefined) {
  const [settings, setSettings] = useState<WhatsAppModuleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!clinicId) return;
    
    try {
      const { data, error } = await fromTable('whatsapp_module_settings')
        .select('*')
        .eq('clinic_id', clinicId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setSettings((data as unknown as WhatsAppModuleSettings) || null);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<WhatsAppModuleSettings>) => {
    if (!clinicId) return;

    const { error } = await fromTable('whatsapp_module_settings')
      .upsert({ 
        clinic_id: clinicId,
        ...updates 
      });

    if (error) {
      toast.error('Erro ao salvar configurações');
      throw error;
    }
    
    toast.success('Configurações salvas');
    fetchSettings();
  };

  return {
    settings,
    isLoading,
    refetch: fetchSettings,
    updateSettings,
  };
}

// Hook to check if module is available for clinic
export function useWhatsAppModuleAccess(clinicId: string | undefined) {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!clinicId) {
        setIsLoading(false);
        return;
      }

      try {
        // First check if clinic has the addon
        const { data: addonData, error: addonError } = await supabase
          .rpc('clinic_has_addon', { 
            _clinic_id: clinicId, 
            _addon_key: 'whatsapp_multiattendance' 
          });

        if (addonError) {
          console.error('Error checking addon:', addonError);
        }

        // If addon is active, grant access
        if (addonData === true) {
          setHasAccess(true);
          setIsLoading(false);
          return;
        }

        // Fallback: check if there are any tickets for this clinic (for testing/demo)
        const { data: ticketsData, error: ticketsError } = await fromTable('whatsapp_tickets')
          .select('id')
          .eq('clinic_id', clinicId)
          .limit(1);

        if (!ticketsError && ticketsData && ticketsData.length > 0) {
          setHasAccess(true);
          setIsLoading(false);
          return;
        }

        // No addon and no tickets - check if user is admin (allow setup)
        const { data: isAdmin } = await supabase
          .rpc('is_clinic_admin', { 
            _user_id: (await supabase.auth.getUser()).data.user?.id,
            _clinic_id: clinicId 
          });

        setHasAccess(isAdmin === true);
      } catch (error) {
        console.error('Error checking module access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [clinicId]);

  return { hasAccess, isLoading };
}
