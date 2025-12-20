-- Create webhooks table
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create webhook_logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  duration_ms INTEGER,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX idx_webhooks_clinic_id ON public.webhooks(clinic_id);
CREATE INDEX idx_webhooks_active ON public.webhooks(is_active) WHERE is_active = true;
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_delivered_at ON public.webhook_logs(delivered_at DESC);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhooks
CREATE POLICY "Clinic admins can manage webhooks"
  ON public.webhooks FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can view webhooks"
  ON public.webhooks FOR SELECT
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for webhook_logs
CREATE POLICY "Clinic admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.webhooks w
    WHERE w.id = webhook_logs.webhook_id
    AND is_clinic_admin(auth.uid(), w.clinic_id)
  ));

CREATE POLICY "System can insert webhook logs"
  ON public.webhook_logs FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();