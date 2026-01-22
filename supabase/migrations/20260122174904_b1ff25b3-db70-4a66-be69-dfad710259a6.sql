-- Tabela para armazenar sessões do fluxo de 2ª via de boletos via WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_boleto_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'INIT',
  
  -- Dados coletados durante o fluxo
  employer_id UUID REFERENCES public.employers(id),
  employer_cnpj VARCHAR(18),
  employer_name VARCHAR(255),
  
  contribution_id UUID REFERENCES public.employer_contributions(id),
  contribution_type_id UUID REFERENCES public.contribution_types(id),
  
  competence_month INTEGER,
  competence_year INTEGER,
  value_cents INTEGER,
  new_due_date DATE,
  
  -- Tipo de boleto (a_vencer ou vencido)
  boleto_type VARCHAR(20),
  
  -- Dados adicionais do fluxo
  available_contributions JSONB,
  flow_context JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '15 minutes')
);

-- Índices para performance
CREATE INDEX idx_whatsapp_boleto_sessions_phone ON public.whatsapp_boleto_sessions(phone);
CREATE INDEX idx_whatsapp_boleto_sessions_clinic_phone ON public.whatsapp_boleto_sessions(clinic_id, phone);
CREATE INDEX idx_whatsapp_boleto_sessions_expires ON public.whatsapp_boleto_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.whatsapp_boleto_sessions ENABLE ROW LEVEL SECURITY;

-- Política para acesso via service role
CREATE POLICY "Service role can manage boleto sessions"
ON public.whatsapp_boleto_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Tabela para logs de interações do fluxo de boletos
CREATE TABLE IF NOT EXISTS public.whatsapp_boleto_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.whatsapp_boleto_sessions(id) ON DELETE SET NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  lytex_request JSONB,
  lytex_response JSONB,
  contribution_id UUID REFERENCES public.employer_contributions(id),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para logs
CREATE INDEX idx_whatsapp_boleto_logs_session ON public.whatsapp_boleto_logs(session_id);
CREATE INDEX idx_whatsapp_boleto_logs_clinic ON public.whatsapp_boleto_logs(clinic_id);
CREATE INDEX idx_whatsapp_boleto_logs_created ON public.whatsapp_boleto_logs(created_at);

-- Enable RLS
ALTER TABLE public.whatsapp_boleto_logs ENABLE ROW LEVEL SECURITY;

-- Política para acesso via service role
CREATE POLICY "Service role can manage boleto logs"
ON public.whatsapp_boleto_logs
FOR ALL
USING (true)
WITH CHECK (true);