
-- Quick Responses table (respostas rápidas com mídia)
CREATE TABLE public.whazing_quick_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  shortcut TEXT,
  body TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whazing_quick_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage quick responses" ON public.whazing_quick_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ticket Tags table
CREATE TABLE public.whazing_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whazing_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage tags" ON public.whazing_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Junction table for ticket-tags
CREATE TABLE public.whazing_ticket_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL,
  tag_id UUID NOT NULL REFERENCES public.whazing_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, tag_id)
);

ALTER TABLE public.whazing_ticket_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage ticket tags" ON public.whazing_ticket_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Queues table (filas fixas)
CREATE TABLE public.whazing_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whazing_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage queues" ON public.whazing_queues
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default queues
INSERT INTO public.whazing_queues (name, color, description) VALUES
  ('Suporte', '#3b82f6', 'Suporte geral'),
  ('Financeiro', '#10b981', 'Questões financeiras'),
  ('Jurídico', '#8b5cf6', 'Questões jurídicas'),
  ('Administrativo', '#f59e0b', 'Questões administrativas');

-- Add queue reference to tickets
ALTER TABLE public.whazing_tickets ADD COLUMN IF NOT EXISTS assigned_queue_id UUID REFERENCES public.whazing_queues(id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.whazing_quick_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whazing_ticket_tags;
