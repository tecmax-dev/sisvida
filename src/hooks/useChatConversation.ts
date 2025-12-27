import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'support' | 'system';
  sender_id: string;
  sender_name: string | null;
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  clinic_id: string | null;
  status: 'open' | 'closed' | 'pending';
  last_message_at: string;
  created_at: string;
}

export const useChatConversation = () => {
  const { user, profile, currentClinic } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch or create conversation
  const getOrCreateConversation = useCallback(async () => {
    if (!user) return null;

    try {
      // Try to find existing open conversation
      const { data: existingConv, error: fetchError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingConv) {
        const conv: Conversation = {
          ...existingConv,
          status: existingConv.status as 'open' | 'closed' | 'pending',
        };
        setConversation(conv);
        return conv;
      }

      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          user_name: profile?.name || user.email?.split('@')[0] || 'Usuário',
          user_email: user.email,
          clinic_id: currentClinic?.id || null,
          status: 'open',
        })
        .select()
        .single();

      if (createError) throw createError;

      const conv: Conversation = {
        ...newConv,
        status: newConv.status as 'open' | 'closed' | 'pending',
      };
      setConversation(conv);
      return conv;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      return null;
    }
  }, [user, profile, currentClinic]);

  // Fetch messages for current conversation
  const fetchMessages = useCallback(async () => {
    if (!conversation?.id) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data as Message[]);

      // Count unread messages from support
      const unread = data?.filter(
        (m) => m.sender_type === 'support' && !m.is_read
      ).length || 0;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [conversation?.id]);

  // Send a message
  const sendMessage = useCallback(async (text: string) => {
    if (!user || !text.trim()) return null;

    try {
      let conv = conversation;
      if (!conv) {
        conv = await getOrCreateConversation();
        if (!conv) return null;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conv.id,
          sender_type: 'user',
          sender_id: user.id,
          sender_name: profile?.name || user.email?.split('@')[0] || 'Usuário',
          message: text.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation last_message_at
      await supabase
        .from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conv.id);

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }, [user, profile, conversation, getOrCreateConversation]);

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!conversation?.id || !user) return;

    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('sender_type', 'support')
        .eq('is_read', false);

      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [conversation?.id, user]);

  // Initialize conversation
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await getOrCreateConversation();
      setIsLoading(false);
    };

    if (user) {
      init();
    }
  }, [user, getOrCreateConversation]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (conversation?.id) {
      fetchMessages();
    }
  }, [conversation?.id, fetchMessages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!conversation?.id) return;

    const channel = supabase
      .channel(`chat-messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          
          if (newMessage.sender_type === 'support') {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  return {
    conversation,
    messages,
    isLoading,
    unreadCount,
    sendMessage,
    markAsRead,
    refetch: fetchMessages,
  };
};
