-- 1) whatsapp_compliance_logs: enable RLS
ALTER TABLE public.whatsapp_compliance_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_compliance_logs FROM anon;
REVOKE ALL ON public.whatsapp_compliance_logs FROM authenticated;
GRANT SELECT ON public.whatsapp_compliance_logs TO authenticated;
GRANT ALL ON public.whatsapp_compliance_logs TO service_role;

DROP POLICY IF EXISTS "Super admins can view whatsapp compliance logs" ON public.whatsapp_compliance_logs;
CREATE POLICY "Super admins can view whatsapp compliance logs"
ON public.whatsapp_compliance_logs
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 2) waiting_list: stop trusting user_metadata
DROP POLICY IF EXISTS "Patients can view their own waiting list records" ON public.waiting_list;
CREATE POLICY "Patients can view their own waiting list records"
ON public.waiting_list
FOR SELECT
TO authenticated
USING (
  patient_id = NULLIF(((auth.jwt() -> 'app_metadata') ->> 'patient_id'), '')::uuid
);

DROP POLICY IF EXISTS "Patients can update their own waiting list records" ON public.waiting_list;
CREATE POLICY "Patients can update their own waiting list records"
ON public.waiting_list
FOR UPDATE
TO authenticated
USING (
  patient_id = NULLIF(((auth.jwt() -> 'app_metadata') ->> 'patient_id'), '')::uuid
)
WITH CHECK (
  patient_id = NULLIF(((auth.jwt() -> 'app_metadata') ->> 'patient_id'), '')::uuid
);

-- 3) sindical_dependentes view: run with the querying user's permissions
ALTER VIEW public.sindical_dependentes SET (security_invoker = on);

-- 4) clinics: restrict anonymous visibility to non-sensitive columns
DROP POLICY IF EXISTS "Public can view clinic basic info" ON public.clinics;
DROP POLICY IF EXISTS "Public can view clinic basic info only" ON public.clinics;
DROP POLICY IF EXISTS "Public can view clinic info via card token" ON public.clinics;

CREATE POLICY "Authenticated can view active clinics"
ON public.clinics
FOR SELECT
TO authenticated
USING ((is_blocked = false) OR (is_blocked IS NULL));

CREATE POLICY "Anon can view public clinic info"
ON public.clinics
FOR SELECT
TO anon
USING ((is_blocked = false) OR (is_blocked IS NULL));

REVOKE SELECT ON public.clinics FROM anon;
GRANT SELECT (
  id, name, slug, logo_url, address, city, state_code,
  opening_time, closing_time, is_blocked, is_maintenance, maintenance_reason,
  app_unavailable, app_unavailable_message,
  holidays_enabled, enforce_schedule_validation, map_view_type, custom_map_embed_url,
  entity_nomenclature, booking_months_ahead, min_advance_booking_hours,
  patient_swap_deadline_hours, max_appointments_per_cpf_month,
  allow_multiple_sessions, dependent_booking_period, dependent_booking_limit,
  dependent_booking_limit_enabled, titular_booking_limit_enabled,
  payslip_acceptance_days, waiting_list_enabled, waiting_list_offer_timeout_minutes,
  hide_pending_before_date, created_at, updated_at
) ON public.clinics TO anon;
GRANT ALL ON public.clinics TO service_role;

-- 5) professionals: anon must not read phone/email/whatsapp
REVOKE SELECT ON public.professionals FROM anon;
GRANT SELECT (
  id, clinic_id, name, specialty, registration_number, council_type,
  avatar_url, schedule, appointment_duration, is_active, slug,
  address, city, state, zip_code, latitude, longitude,
  bio, education, experience, telemedicine_enabled, max_patient_age,
  created_at, updated_at
) ON public.professionals TO anon;
GRANT ALL ON public.professionals TO service_role;

-- 6) email_confirmations: only for your own account
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.email_confirmations;
CREATE POLICY "Users can insert their own email confirmations"
ON public.email_confirmations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 7) sindical_associados: validate public affiliation submissions
DROP POLICY IF EXISTS "Público pode solicitar filiação" ON public.sindical_associados;
CREATE POLICY "Público pode solicitar filiação"
ON public.sindical_associados
FOR INSERT
TO anon, authenticated
WITH CHECK (
  sindicato_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.union_entities ue
    WHERE ue.id = sindical_associados.sindicato_id
      AND ue.status = 'ativa'::union_entity_status
  )
  AND nome IS NOT NULL
  AND length(btrim(nome)) >= 3
  AND cpf IS NOT NULL
  AND length(regexp_replace(cpf, '\D', '', 'g')) = 11
);

-- 8) homologacao_appointments: validate confirmation token via a security definer function
CREATE OR REPLACE FUNCTION public.homologacao_token_matches(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _header text;
  _provided uuid;
BEGIN
  IF _token IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    _header := (current_setting('request.headers', true)::json ->> 'x-confirmation-token');
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF _header IS NULL OR length(btrim(_header)) = 0 THEN
    RETURN false;
  END IF;

  BEGIN
    _provided := _header::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN _provided = _token;
END;
$$;

REVOKE ALL ON FUNCTION public.homologacao_token_matches(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.homologacao_token_matches(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "anon_can_select_homologacao_appointments" ON public.homologacao_appointments;
CREATE POLICY "anon_can_select_homologacao_appointments"
ON public.homologacao_appointments
FOR SELECT
TO anon, authenticated
USING (public.homologacao_token_matches(confirmation_token));

DROP POLICY IF EXISTS "update_homologacao_cancel_via_token" ON public.homologacao_appointments;
CREATE POLICY "update_homologacao_cancel_via_token"
ON public.homologacao_appointments
FOR UPDATE
TO anon, authenticated
USING (public.homologacao_token_matches(confirmation_token))
WITH CHECK (status = 'cancelled'::text);