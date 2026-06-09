
CREATE TABLE public.whatsapp_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  phone text NOT NULL,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  source text NOT NULL DEFAULT 'user_reply',
  reactivated_at timestamptz,
  reactivated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_opt_outs TO authenticated;
GRANT ALL ON public.whatsapp_opt_outs TO service_role;

ALTER TABLE public.whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins manage whatsapp opt-outs"
  ON public.whatsapp_opt_outs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_clinic_admin(auth.uid(), clinic_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_clinic_admin(auth.uid(), clinic_id));

CREATE INDEX idx_whatsapp_opt_outs_phone ON public.whatsapp_opt_outs (clinic_id, phone) WHERE reactivated_at IS NULL;

CREATE TRIGGER trg_whatsapp_opt_outs_updated_at
  BEFORE UPDATE ON public.whatsapp_opt_outs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  phone text,
  event text NOT NULL,
  meta_error_code text,
  template_name text,
  source_function text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_policy_events TO authenticated;
GRANT ALL ON public.whatsapp_policy_events TO service_role;

ALTER TABLE public.whatsapp_policy_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view whatsapp policy events"
  ON public.whatsapp_policy_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (clinic_id IS NOT NULL AND public.is_clinic_admin(auth.uid(), clinic_id)));

CREATE INDEX idx_whatsapp_policy_events_created ON public.whatsapp_policy_events (created_at DESC);
CREATE INDEX idx_whatsapp_policy_events_phone ON public.whatsapp_policy_events (clinic_id, phone, created_at DESC);
CREATE INDEX idx_whatsapp_policy_events_event ON public.whatsapp_policy_events (event, created_at DESC);
