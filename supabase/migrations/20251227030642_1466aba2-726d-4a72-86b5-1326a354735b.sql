-- =============================================
-- CHAT SUPPORT SYSTEM TABLES
-- =============================================

-- 1. Chat Settings (global configuration)
CREATE TABLE public.chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  auto_offline_message text DEFAULT 'Nosso atendimento está offline no momento. Deixe sua mensagem que retornaremos assim que possível.',
  timezone text DEFAULT 'America/Sao_Paulo',
  manual_override text CHECK (manual_override IN ('online', 'offline', NULL)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.chat_settings (id) VALUES (gen_random_uuid());

-- 2. Chat Working Hours (schedule by day)
CREATE TABLE public.chat_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(day_of_week)
);

-- Insert default working hours (Mon-Fri 9-18)
INSERT INTO public.chat_working_hours (day_of_week, start_time, end_time, is_active) VALUES
  (0, '09:00', '18:00', false), -- Sunday
  (1, '09:00', '18:00', true),  -- Monday
  (2, '09:00', '18:00', true),  -- Tuesday
  (3, '09:00', '18:00', true),  -- Wednesday
  (4, '09:00', '18:00', true),  -- Thursday
  (5, '09:00', '18:00', true),  -- Friday
  (6, '09:00', '18:00', false); -- Saturday

-- 3. Chat Conversations
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  user_email text,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
  last_message_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Chat Messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'support', 'system')),
  sender_id uuid NOT NULL,
  sender_name text,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_chat_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_status ON public.chat_conversations(status);
CREATE INDEX idx_chat_conversations_last_message ON public.chat_conversations(last_message_at DESC);
CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_settings policies
CREATE POLICY "Anyone can view chat settings" ON public.chat_settings
  FOR SELECT USING (true);

CREATE POLICY "Super admins can manage chat settings" ON public.chat_settings
  FOR ALL USING (is_super_admin(auth.uid()));

-- chat_working_hours policies
CREATE POLICY "Anyone can view working hours" ON public.chat_working_hours
  FOR SELECT USING (true);

CREATE POLICY "Super admins can manage working hours" ON public.chat_working_hours
  FOR ALL USING (is_super_admin(auth.uid()));

-- chat_conversations policies
CREATE POLICY "Users can view their own conversations" ON public.chat_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" ON public.chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON public.chat_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all conversations" ON public.chat_conversations
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all conversations" ON public.chat_conversations
  FOR ALL USING (is_super_admin(auth.uid()));

-- chat_messages policies
CREATE POLICY "Users can view messages of their conversations" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their conversations" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
    )
    AND sender_type = 'user'
    AND sender_id = auth.uid()
  );

CREATE POLICY "Super admins can view all messages" ON public.chat_messages
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all messages" ON public.chat_messages
  FOR ALL USING (is_super_admin(auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at for chat_settings
CREATE TRIGGER update_chat_settings_updated_at
  BEFORE UPDATE ON public.chat_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update updated_at for chat_working_hours
CREATE TRIGGER update_chat_working_hours_updated_at
  BEFORE UPDATE ON public.chat_working_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update updated_at for chat_conversations
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;