CREATE OR REPLACE FUNCTION public.get_public_contribution_types(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic uuid;
  v_result jsonb;
BEGIN
  SELECT ec.clinic_id INTO v_clinic
  FROM public.employer_contributions ec
  WHERE ec.public_access_token = p_token
  LIMIT 1;

  IF v_clinic IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'default_value', t.default_value) ORDER BY t.name), '[]'::jsonb)
  INTO v_result
  FROM public.contribution_types t
  WHERE t.clinic_id = v_clinic AND COALESCE(t.is_active, true) = true;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_contribution_type_by_public_token(p_token text, p_type_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.employer_contributions%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.employer_contributions
  WHERE public_access_token = p_token
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;

  -- Só permite trocar o tipo em boletos ainda não pagos e sem boleto válido emitido
  IF v_row.status NOT IN ('awaiting_value', 'pending', 'overdue') THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contribution_types t
    WHERE t.id = p_type_id
      AND t.clinic_id = v_row.clinic_id
      AND COALESCE(t.is_active, true) = true
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.employer_contributions
  SET contribution_type_id = p_type_id
  WHERE id = v_row.id;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_contribution_types(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_contribution_type_by_public_token(text, uuid) TO anon, authenticated;