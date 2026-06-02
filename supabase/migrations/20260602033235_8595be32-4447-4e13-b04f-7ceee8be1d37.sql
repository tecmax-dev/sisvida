
-- Bulk email campaigns for /union module

CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  union_entity_id UUID,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('associados','empresas','escritorios','custom')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','sending','completed','failed','cancelled')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_campaigns_clinic ON public.email_campaigns(clinic_id, created_at DESC);
CREATE INDEX idx_email_campaigns_status ON public.email_campaigns(status) WHERE status IN ('queued','sending');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users manage email campaigns"
ON public.email_campaigns FOR ALL
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id = email_campaigns.clinic_id))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id = email_campaigns.clinic_id));

CREATE TRIGGER trg_email_campaigns_updated_at
BEFORE UPDATE ON public.email_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recipients
CREATE TABLE public.email_campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL,
  recipient_id UUID,
  recipient_name TEXT,
  recipient_email TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped','unsubscribed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_recipients_campaign ON public.email_campaign_recipients(campaign_id, status);
CREATE INDEX idx_email_recipients_pending ON public.email_campaign_recipients(campaign_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_recipients TO authenticated;
GRANT ALL ON public.email_campaign_recipients TO service_role;

ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users manage campaign recipients"
ON public.email_campaign_recipients FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.email_campaigns c
  JOIN public.user_roles ur ON ur.clinic_id = c.clinic_id
  WHERE c.id = email_campaign_recipients.campaign_id AND ur.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.email_campaigns c
  JOIN public.user_roles ur ON ur.clinic_id = c.clinic_id
  WHERE c.id = email_campaign_recipients.campaign_id AND ur.user_id = auth.uid()
));

-- Unsubscribes
CREATE TABLE public.email_unsubscribes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  email TEXT NOT NULL,
  reason TEXT,
  source_campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, email)
);

CREATE INDEX idx_email_unsubscribes_email ON public.email_unsubscribes(clinic_id, email);

GRANT SELECT, INSERT ON public.email_unsubscribes TO authenticated;
GRANT ALL ON public.email_unsubscribes TO service_role;

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users view unsubscribes"
ON public.email_unsubscribes FOR SELECT
USING (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id = email_unsubscribes.clinic_id));

CREATE POLICY "Clinic users insert unsubscribes"
ON public.email_unsubscribes FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id = email_unsubscribes.clinic_id));
