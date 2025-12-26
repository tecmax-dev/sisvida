-- Tabela para rastrear confirmações pendentes de WhatsApp
CREATE TABLE public.pending_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, cancelled, expired
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida por telefone
CREATE INDEX idx_pending_confirmations_phone ON public.pending_confirmations(phone);
CREATE INDEX idx_pending_confirmations_status ON public.pending_confirmations(status);
CREATE INDEX idx_pending_confirmations_expires_at ON public.pending_confirmations(expires_at);

-- Habilitar RLS
ALTER TABLE public.pending_confirmations ENABLE ROW LEVEL SECURITY;

-- Política para sistema inserir/atualizar
CREATE POLICY "System can manage pending confirmations"
ON public.pending_confirmations FOR ALL
USING (true)
WITH CHECK (true);

-- Tabela para log de mensagens recebidas do WhatsApp
CREATE TABLE public.whatsapp_incoming_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message_text TEXT,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_action TEXT, -- confirmed, cancelled, ignored
  processed_appointment_id UUID REFERENCES public.appointments(id),
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca
CREATE INDEX idx_whatsapp_incoming_logs_phone ON public.whatsapp_incoming_logs(phone);
CREATE INDEX idx_whatsapp_incoming_logs_received_at ON public.whatsapp_incoming_logs(received_at);

-- Habilitar RLS
ALTER TABLE public.whatsapp_incoming_logs ENABLE ROW LEVEL SECURITY;

-- Política para sistema inserir
CREATE POLICY "System can insert whatsapp logs"
ON public.whatsapp_incoming_logs FOR INSERT
WITH CHECK (true);

-- Política para admins visualizarem logs de suas clínicas
CREATE POLICY "Clinic admins can view whatsapp logs"
ON public.whatsapp_incoming_logs FOR SELECT
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Adicionar coluna na evolution_configs para habilitar confirmação direta
ALTER TABLE public.evolution_configs 
ADD COLUMN IF NOT EXISTS direct_reply_enabled BOOLEAN DEFAULT false;

-- Adicionar coluna para URL do webhook configurado
ALTER TABLE public.evolution_configs 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;