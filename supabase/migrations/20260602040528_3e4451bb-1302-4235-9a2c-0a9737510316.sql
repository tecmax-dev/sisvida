
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

ALTER TABLE public.email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_status_check;
ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (status IN ('draft','scheduled','queued','sending','completed','failed','cancelled'));

CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled
  ON public.email_campaigns(scheduled_at)
  WHERE status = 'scheduled';
