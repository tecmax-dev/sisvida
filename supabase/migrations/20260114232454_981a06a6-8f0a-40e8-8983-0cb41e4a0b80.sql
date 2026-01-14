-- Tabela para armazenar tokens de dispositivos para push notifications
CREATE TABLE public.push_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, token)
);

-- Índices
CREATE INDEX idx_push_tokens_clinic ON public.push_notification_tokens(clinic_id);
CREATE INDEX idx_push_tokens_patient ON public.push_notification_tokens(patient_id);
CREATE INDEX idx_push_tokens_active ON public.push_notification_tokens(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Patients can manage their own tokens"
  ON public.push_notification_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tabela para histórico de notificações enviadas
CREATE TABLE public.push_notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_by UUID,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'specific', 'segment')),
  target_patient_ids UUID[],
  total_sent INTEGER DEFAULT 0,
  total_success INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_push_history_clinic ON public.push_notification_history(clinic_id);
CREATE INDEX idx_push_history_sent_at ON public.push_notification_history(sent_at DESC);

-- RLS
ALTER TABLE public.push_notification_history ENABLE ROW LEVEL SECURITY;

-- Políticas para histórico
CREATE POLICY "Super admins can manage push history"
  ON public.push_notification_history
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Union admins can manage push history"
  ON public.push_notification_history
  FOR ALL
  USING (public.has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_union_module_access(auth.uid(), clinic_id));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_notification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();