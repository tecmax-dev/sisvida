CREATE TABLE public.zapster_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID,
  instance_id TEXT,
  event_type TEXT NOT NULL,
  event_id TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  summary TEXT,
  sender TEXT,
  message_preview TEXT,
  payload JSONB,
  forwarded_status INTEGER,
  forwarded_response TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_zapster_logs_clinic_created ON public.zapster_webhook_logs (clinic_id, created_at DESC);
CREATE INDEX idx_zapster_logs_status ON public.zapster_webhook_logs (status);

ALTER TABLE public.zapster_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins/owners can view their webhook logs"
ON public.zapster_webhook_logs
FOR SELECT
TO authenticated
USING (
  clinic_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.clinic_id = zapster_webhook_logs.clinic_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('admin','owner','entidade_sindical_admin')
  )
);