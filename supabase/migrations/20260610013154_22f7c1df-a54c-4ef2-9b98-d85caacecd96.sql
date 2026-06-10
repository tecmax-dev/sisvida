
CREATE TABLE IF NOT EXISTS public.meta_safe_mode_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  safe_mode boolean NOT NULL DEFAULT true,
  maintenance_mode boolean NOT NULL DEFAULT false,
  dry_run boolean NOT NULL DEFAULT false,
  max_per_hour integer NOT NULL DEFAULT 50,
  max_per_day integer NOT NULL DEFAULT 500,
  max_per_contact_30d integer NOT NULL DEFAULT 5,
  circuit_breaker_open boolean NOT NULL DEFAULT false,
  circuit_reason text,
  circuit_opened_at timestamptz,
  go_live_stage integer NOT NULL DEFAULT 4 CHECK (go_live_stage BETWEEN 0 AND 4),
  go_live_started_at timestamptz,
  manual_override boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.meta_safe_mode_config TO authenticated;
GRANT ALL ON public.meta_safe_mode_config TO service_role;

ALTER TABLE public.meta_safe_mode_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read safe mode config"
  ON public.meta_safe_mode_config FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

INSERT INTO public.meta_safe_mode_config (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.meta_safe_mode_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_safe_mode_audit TO authenticated;
GRANT ALL ON public.meta_safe_mode_audit TO service_role;

ALTER TABLE public.meta_safe_mode_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read safe mode audit"
  ON public.meta_safe_mode_audit FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_meta_safe_mode_audit_created
  ON public.meta_safe_mode_audit (created_at DESC);

CREATE OR REPLACE FUNCTION public.meta_safe_mode_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);
  FOR v_field IN SELECT jsonb_object_keys(v_new) LOOP
    IF v_field IN ('updated_at','updated_by','id','singleton') THEN
      CONTINUE;
    END IF;
    IF (v_old -> v_field) IS DISTINCT FROM (v_new -> v_field) THEN
      INSERT INTO public.meta_safe_mode_audit (field, old_value, new_value, changed_by)
      VALUES (v_field, v_old -> v_field, v_new -> v_field, NEW.updated_by);
    END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_safe_mode_audit ON public.meta_safe_mode_config;
CREATE TRIGGER trg_meta_safe_mode_audit
  BEFORE UPDATE ON public.meta_safe_mode_config
  FOR EACH ROW EXECUTE FUNCTION public.meta_safe_mode_audit_trigger();

CREATE OR REPLACE VIEW public.meta_health_score_v AS
WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM public.whatsapp_template_logs
       WHERE sent_at > now() - interval '24 hours' AND status = 'sent') AS sent_24h,
    (SELECT COUNT(*) FROM public.whatsapp_template_logs
       WHERE sent_at > now() - interval '24 hours' AND status LIKE 'blocked_%') AS blocked_24h,
    (SELECT COUNT(*) FROM public.whatsapp_template_logs
       WHERE sent_at > now() - interval '24 hours' AND status IN ('failed','error')) AS failed_24h,
    (SELECT COUNT(*) FROM public.whatsapp_meta_templates
       WHERE status IN ('REJECTED','PAUSED','DISABLED')) AS bad_templates,
    (SELECT COUNT(*) FROM public.whatsapp_opt_outs
       WHERE opted_out_at > now() - interval '24 hours' AND reactivated_at IS NULL) AS optouts_24h
),
score AS (
  SELECT
    GREATEST(0, LEAST(100,
      100
      - LEAST(40, blocked_24h * 2)
      - LEAST(30, failed_24h  * 3)
      - LEAST(20, bad_templates * 5)
      - LEAST(20, optouts_24h * 4)
    )) AS health_score,
    sent_24h, blocked_24h, failed_24h, bad_templates, optouts_24h
  FROM stats
)
SELECT
  health_score,
  CASE
    WHEN health_score >= 80 THEN 'excellent'
    WHEN health_score >= 60 THEN 'attention'
    WHEN health_score >= 40 THEN 'risk'
    WHEN health_score >= 20 THEN 'critical'
    ELSE 'suspend'
  END AS health_label,
  sent_24h, blocked_24h, failed_24h, bad_templates, optouts_24h
FROM score;

GRANT SELECT ON public.meta_health_score_v TO authenticated, service_role;
