-- Create whazing_messages table for storing chat messages
CREATE TABLE public.whazing_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  message_id TEXT,
  body TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  media_type TEXT,
  media_url TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  status TEXT,
  timestamp BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id)
);

-- Index for fast lookups by ticket
CREATE INDEX idx_whazing_messages_ticket_id ON public.whazing_messages(ticket_id);
CREATE INDEX idx_whazing_messages_timestamp ON public.whazing_messages(ticket_id, timestamp);

-- RLS - allow authenticated users to read
ALTER TABLE public.whazing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read whazing messages"
  ON public.whazing_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage whazing messages"
  ON public.whazing_messages FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.whazing_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whazing_messages;