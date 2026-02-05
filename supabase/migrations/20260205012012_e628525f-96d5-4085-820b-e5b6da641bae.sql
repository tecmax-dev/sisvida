-- Criar tabela de logs do webhook de assinatura
CREATE TABLE IF NOT EXISTS public.subscription_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id),
  invoice_id UUID REFERENCES public.subscription_invoices(id),
  webhook_type TEXT NOT NULL DEFAULT 'unknown',
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.subscription_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas - apenas super admins podem ler
CREATE POLICY "Super admins can read subscription webhook logs"
  ON public.subscription_webhook_logs
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
  );

-- Index para busca
CREATE INDEX idx_subscription_webhook_logs_invoice ON public.subscription_webhook_logs(invoice_id);
CREATE INDEX idx_subscription_webhook_logs_created ON public.subscription_webhook_logs(created_at DESC);