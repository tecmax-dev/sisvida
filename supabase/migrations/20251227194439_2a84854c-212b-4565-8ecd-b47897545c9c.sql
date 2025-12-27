
-- =====================================================
-- FASE 3: Painel e Totem de Atendimento
-- =====================================================

-- 1. Filas de Atendimento
CREATE TABLE public.queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  queue_type TEXT NOT NULL DEFAULT 'general' CHECK (queue_type IN ('general', 'priority', 'scheduled')),
  display_mode TEXT NOT NULL DEFAULT 'name' CHECK (display_mode IN ('name', 'ticket', 'initials')),
  ticket_prefix TEXT DEFAULT 'A',
  current_ticket INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_queues_clinic ON public.queues(clinic_id);
CREATE INDEX idx_queues_active ON public.queues(clinic_id, is_active) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queues_select" ON public.queues
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "queues_admin" ON public.queues
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger
CREATE TRIGGER update_queues_updated_at
  BEFORE UPDATE ON public.queues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Chamadas de Pacientes na Fila
CREATE TABLE public.queue_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  ticket_number INTEGER NOT NULL,
  ticket_prefix TEXT,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  room_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'no_show')),
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  called_at TIMESTAMP WITH TIME ZONE,
  attended_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  wait_time_seconds INTEGER,
  service_time_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_queue_calls_clinic ON public.queue_calls(clinic_id);
CREATE INDEX idx_queue_calls_queue ON public.queue_calls(queue_id);
CREATE INDEX idx_queue_calls_status ON public.queue_calls(queue_id, status);
CREATE INDEX idx_queue_calls_patient ON public.queue_calls(patient_id);
CREATE INDEX idx_queue_calls_date ON public.queue_calls(clinic_id, created_at);

-- RLS
ALTER TABLE public.queue_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_calls_select" ON public.queue_calls
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "queue_calls_admin" ON public.queue_calls
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Permitir insert público para check-in
CREATE POLICY "queue_calls_public_insert" ON public.queue_calls
  FOR INSERT WITH CHECK (true);

-- 3. Painéis de Exibição
CREATE TABLE public.panels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_config JSONB DEFAULT '{"showLogo": true, "showTime": true, "callSound": true, "voiceEnabled": false}'::jsonb,
  queue_ids UUID[] DEFAULT ARRAY[]::UUID[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_panels_clinic ON public.panels(clinic_id);
CREATE INDEX idx_panels_token ON public.panels(token);

-- RLS
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "panels_select" ON public.panels
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id) OR token IS NOT NULL);

CREATE POLICY "panels_admin" ON public.panels
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger
CREATE TRIGGER update_panels_updated_at
  BEFORE UPDATE ON public.panels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Totens de Check-in
CREATE TABLE public.totems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
  token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_totems_clinic ON public.totems(clinic_id);
CREATE INDEX idx_totems_token ON public.totems(token);

-- RLS
ALTER TABLE public.totems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "totems_select" ON public.totems
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id) OR token IS NOT NULL);

CREATE POLICY "totems_admin" ON public.totems
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger
CREATE TRIGGER update_totems_updated_at
  BEFORE UPDATE ON public.totems
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Função para gerar próximo número da fila
CREATE OR REPLACE FUNCTION public.generate_queue_ticket(p_queue_id UUID)
RETURNS TABLE (ticket_number INTEGER, ticket_prefix TEXT) AS $$
DECLARE
  v_queue RECORD;
  v_next_ticket INTEGER;
BEGIN
  SELECT q.ticket_prefix, q.current_ticket INTO v_queue
  FROM public.queues q
  WHERE q.id = p_queue_id;
  
  v_next_ticket := COALESCE(v_queue.current_ticket, 0) + 1;
  
  UPDATE public.queues
  SET current_ticket = v_next_ticket
  WHERE id = p_queue_id;
  
  RETURN QUERY SELECT v_next_ticket, v_queue.ticket_prefix;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Extensão da waiting_list para integração
ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_number INTEGER,
  ADD COLUMN IF NOT EXISTS ticket_prefix TEXT;

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.panels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.totems;
