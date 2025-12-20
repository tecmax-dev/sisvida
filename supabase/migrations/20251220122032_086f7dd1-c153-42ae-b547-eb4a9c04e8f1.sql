-- Tabela para armazenar API Keys das clínicas
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_preview TEXT NOT NULL,
  permissions JSONB DEFAULT '["read:professionals", "read:availability", "read:patients", "create:patients", "read:appointments", "create:appointments", "cancel:appointments", "read:history"]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID
);

-- Tabela para logs de auditoria das chamadas de API
CREATE TABLE public.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  ip_address TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_api_keys_clinic_id ON public.api_keys(clinic_id);
CREATE INDEX idx_api_keys_api_key_hash ON public.api_keys(api_key_hash);
CREATE INDEX idx_api_keys_is_active ON public.api_keys(is_active);
CREATE INDEX idx_api_logs_clinic_id ON public.api_logs(clinic_id);
CREATE INDEX idx_api_logs_api_key_id ON public.api_logs(api_key_id);
CREATE INDEX idx_api_logs_created_at ON public.api_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para api_keys
CREATE POLICY "Clinic admins can manage their API keys"
  ON public.api_keys FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can view their API keys"
  ON public.api_keys FOR SELECT
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies para api_logs
CREATE POLICY "Clinic admins can view their API logs"
  ON public.api_logs FOR SELECT
  USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "System can insert API logs"
  ON public.api_logs FOR INSERT
  WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();