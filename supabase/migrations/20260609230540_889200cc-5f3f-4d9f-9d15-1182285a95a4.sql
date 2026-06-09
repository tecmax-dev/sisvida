
-- ---- 1. contact_preferences -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  phone text NOT NULL,
  whatsapp_optin boolean NOT NULL DEFAULT false,
  whatsapp_optin_at timestamptz,
  whatsapp_optin_source text,
  whatsapp_optout boolean NOT NULL DEFAULT false,
  whatsapp_optout_at timestamptz,
  whatsapp_optout_source text,
  optout_categories text[] NOT NULL DEFAULT '{}',
  last_interaction_at timestamptz,
  last_inbound_at timestamptz,
  last_template_sent_at timestamptz,
  last_template_name text,
  interaction_score integer NOT NULL DEFAULT 50,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_contact_prefs_clinic_phone ON public.contact_preferences(clinic_id, phone);
CREATE INDEX IF NOT EXISTS idx_contact_prefs_optout ON public.contact_preferences(clinic_id) WHERE whatsapp_optout = true;
CREATE INDEX IF NOT EXISTS idx_contact_prefs_score ON public.contact_preferences(clinic_id, interaction_score);

GRANT SELECT, INSERT, UPDATE ON public.contact_preferences TO authenticated;
GRANT ALL ON public.contact_preferences TO service_role;

ALTER TABLE public.contact_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins manage contact preferences"
  ON public.contact_preferences FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_clinic_admin(auth.uid(), clinic_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_clinic_admin(auth.uid(), clinic_id));

CREATE TRIGGER trg_contact_prefs_updated_at
  BEFORE UPDATE ON public.contact_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- 2. whatsapp_template_logs ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_template_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  phone text NOT NULL,
  template_name text NOT NULL,
  category text,
  purpose text,
  status text NOT NULL,
  reason text,
  meta_message_id text,
  meta_error_code text,
  optin_source text,
  interaction_score_at_send integer,
  triggered_by text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wa_tpl_logs_clinic_phone ON public.whatsapp_template_logs(clinic_id, phone, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_tpl_logs_template ON public.whatsapp_template_logs(template_name, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_tpl_logs_status ON public.whatsapp_template_logs(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_tpl_logs_meta_id ON public.whatsapp_template_logs(meta_message_id) WHERE meta_message_id IS NOT NULL;

GRANT SELECT ON public.whatsapp_template_logs TO authenticated;
GRANT ALL ON public.whatsapp_template_logs TO service_role;

ALTER TABLE public.whatsapp_template_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read template logs"
  ON public.whatsapp_template_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR (clinic_id IS NOT NULL AND public.is_clinic_admin(auth.uid(), clinic_id)));

-- ---- 3. Colunas auxiliares -------------------------------------------------
ALTER TABLE public.whatsapp_meta_templates
  ADD COLUMN IF NOT EXISTS deprecated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deprecation_reason text;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS blocked_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_whatsapp_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_whatsapp_reason text;

-- ---- 4. calc_interaction_score ---------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_interaction_score(_clinic_id uuid, _phone text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_optout boolean;
  v_last_inbound timestamptz;
  v_last_outbound timestamptz;
  v_days_inbound numeric;
BEGIN
  SELECT whatsapp_optout, last_inbound_at, last_template_sent_at
    INTO v_optout, v_last_inbound, v_last_outbound
  FROM public.contact_preferences
  WHERE clinic_id = _clinic_id AND phone = _phone;

  IF v_optout IS TRUE THEN RETURN 0; END IF;

  IF v_last_inbound IS NULL THEN
    IF v_last_outbound IS NULL THEN RETURN 50; END IF;
    RETURN 40;
  END IF;

  v_days_inbound := EXTRACT(EPOCH FROM (now() - v_last_inbound)) / 86400.0;
  IF v_days_inbound <= 7   THEN RETURN 100;
  ELSIF v_days_inbound <= 30  THEN RETURN 80;
  ELSIF v_days_inbound <= 90  THEN RETURN 60;
  ELSIF v_days_inbound <= 180 THEN RETURN 40;
  ELSIF v_days_inbound <= 365 THEN RETURN 20;
  ELSE                              RETURN 10;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_interaction_score(uuid, text) TO authenticated, service_role;

-- ---- 5. wa_can_send (gate único) -------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_can_send(
  _clinic_id uuid,
  _phone text,
  _template text,
  _category text,
  _purpose text,
  _min_score integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pref public.contact_preferences%ROWTYPE;
  v_score int;
  v_count_24h int;
  v_count_7d int;
  v_count_30d int;
  v_is_critical boolean;
BEGIN
  v_is_critical := _template IN ('recuperacao_senha', 'consulta_cancelamento');

  SELECT * INTO v_pref FROM public.contact_preferences
   WHERE clinic_id = _clinic_id AND phone = _phone;

  IF v_pref.whatsapp_optout IS TRUE AND (v_pref.optout_categories = '{}' OR _category = ANY(v_pref.optout_categories)) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked_optout', 'score', 0);
  END IF;

  IF _category = 'MARKETING' THEN
    IF v_pref.whatsapp_optin IS NOT TRUE OR v_pref.whatsapp_optin_source NOT IN ('app','portal','site','formulario') THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'blocked_consent', 'score', COALESCE(v_pref.interaction_score, 0));
    END IF;
  END IF;

  IF NOT v_is_critical AND COALESCE(v_pref.whatsapp_optin, false) = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked_consent', 'score', COALESCE(v_pref.interaction_score, 0));
  END IF;

  v_score := public.calc_interaction_score(_clinic_id, _phone);
  IF NOT v_is_critical AND v_score < _min_score THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked_score', 'score', v_score);
  END IF;

  SELECT COUNT(*) INTO v_count_24h FROM public.whatsapp_template_logs
   WHERE clinic_id = _clinic_id AND phone = _phone AND status = 'sent'
     AND purpose = _purpose AND sent_at >= now() - interval '24 hours';
  IF NOT v_is_critical AND v_count_24h >= 1 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked_rate_24h', 'score', v_score);
  END IF;

  SELECT COUNT(*) INTO v_count_7d FROM public.whatsapp_template_logs
   WHERE clinic_id = _clinic_id AND phone = _phone AND status = 'sent'
     AND purpose = _purpose AND sent_at >= now() - interval '7 days';
  IF NOT v_is_critical AND v_count_7d >= 2 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked_rate_7d', 'score', v_score);
  END IF;

  SELECT COUNT(*) INTO v_count_30d FROM public.whatsapp_template_logs
   WHERE clinic_id = _clinic_id AND phone = _phone AND status = 'sent'
     AND sent_at >= now() - interval '30 days';
  IF NOT v_is_critical AND v_count_30d >= 5
     AND (v_pref.last_inbound_at IS NULL OR v_pref.last_inbound_at < now() - interval '30 days') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'blocked_rate_30d', 'score', v_score);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', 'ok', 'score', v_score);
END;
$$;

GRANT EXECUTE ON FUNCTION public.wa_can_send(uuid, text, text, text, text, integer) TO authenticated, service_role;
