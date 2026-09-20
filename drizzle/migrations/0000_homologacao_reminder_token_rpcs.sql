CREATE OR REPLACE FUNCTION public.get_homologacao_by_confirmation_token(_token text)
RETURNS TABLE (
  id uuid,
  appointment_date date,
  start_time time,
  status text,
  employee_name text,
  company_name text,
  professional_name text,
  clinic_name text,
  clinic_address text,
  clinic_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.id,
    h.appointment_date,
    h.start_time,
    h.status::text,
    h.employee_name,
    h.company_name,
    p.name AS professional_name,
    c.name AS clinic_name,
    c.address AS clinic_address,
    c.phone AS clinic_phone
  FROM public.homologacao_appointments h
  LEFT JOIN public.professionals p ON p.id = h.professional_id
  LEFT JOIN public.clinics c ON c.id = h.clinic_id
  WHERE _token IS NOT NULL
    AND length(_token) >= 16
    AND h.confirmation_token::text = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.act_on_homologacao_by_token(
  _token text,
  _action text,
  _reason text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.homologacao_appointments%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN 'INVALID_TOKEN';
  END IF;

  SELECT * INTO v_row
  FROM public.homologacao_appointments
  WHERE confirmation_token::text = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF v_row.status::text IN ('cancelled', 'completed') THEN
    RETURN 'NOT_ELIGIBLE';
  END IF;

  IF _action = 'confirm' THEN
    UPDATE public.homologacao_appointments
    SET status = 'confirmed', confirmed_at = now(), updated_at = now()
    WHERE id = v_row.id;
    RETURN 'OK';

  ELSIF _action = 'cancel' THEN
    UPDATE public.homologacao_appointments
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = COALESCE(NULLIF(trim(_reason), ''), 'Cancelado pelo link do lembrete'),
        updated_at = now()
    WHERE id = v_row.id;
    RETURN 'OK';

  ELSIF _action = 'reschedule' THEN
    UPDATE public.homologacao_appointments
    SET notes = COALESCE(v_row.notes || E'\n', '')
                || '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
                || '] Solicitacao de reagendamento pelo link do lembrete'
                || COALESCE(': ' || NULLIF(trim(_reason), ''), ''),
        updated_at = now()
    WHERE id = v_row.id;
    RETURN 'OK';
  END IF;

  RETURN 'INVALID_ACTION';
END;
$$;

REVOKE ALL ON FUNCTION public.get_homologacao_by_confirmation_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.act_on_homologacao_by_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_homologacao_by_confirmation_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_homologacao_by_token(text, text, text) TO anon, authenticated;