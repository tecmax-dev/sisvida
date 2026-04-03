CREATE TABLE public.whazing_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  queue_id TEXT,
  user_id_whazing TEXT,
  subject TEXT,
  last_message TEXT,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  holiday_notified BOOLEAN DEFAULT false,
  holiday_notified_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  UNIQUE(ticket_id)
);

ALTER TABLE public.whazing_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whazing_tickets"
  ON public.whazing_tickets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_whazing_tickets_status ON public.whazing_tickets(status);
CREATE INDEX idx_whazing_tickets_contact ON public.whazing_tickets(contact_number);