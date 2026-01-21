-- Fix: set explicit search_path for functions flagged by linter
-- Target: functions created/updated in this change + related

CREATE OR REPLACE FUNCTION public.check_professional_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
  existing_name text;
  reg_norm text;
BEGIN
  -- REGRA 1: 1 profissional ativo por (clinic_id, user_id)
  IF NEW.user_id IS NOT NULL AND NEW.is_active = true THEN
    SELECT id, name INTO existing_id, existing_name
    FROM public.professionals
    WHERE clinic_id = NEW.clinic_id
      AND user_id = NEW.user_id
      AND is_active = true
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'PROFISSIONAL_DUPLICADO: Já existe um profissional ativo (%) vinculado a este usuário nesta clínica.', existing_name;
    END IF;
  END IF;

  -- REGRA 2: 1 profissional ativo por (clinic_id, registration_number normalizado)
  IF NEW.is_active = true AND NEW.registration_number IS NOT NULL THEN
    reg_norm := upper(regexp_replace(NEW.registration_number, '[^A-Za-z0-9]', '', 'g'));

    SELECT id, name INTO existing_id, existing_name
    FROM public.professionals
    WHERE clinic_id = NEW.clinic_id
      AND is_active = true
      AND registration_number IS NOT NULL
      AND upper(regexp_replace(registration_number, '[^A-Za-z0-9]', '', 'g')) = reg_norm
      AND coalesce(state, '') = coalesce(NEW.state, '')
      AND coalesce(council_type, '') = coalesce(NEW.council_type, '')
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'PROFISSIONAL_DUPLICADO_REG: Já existe um profissional ativo (%) com este registro nesta clínica.', existing_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Also set search_path for other mutable-search_path functions if present
DO $$
BEGIN
  -- best-effort: update existing function definitions that are known and safe
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='update_overdue_contributions') THEN
    EXECUTE 'CREATE OR REPLACE FUNCTION public.update_overdue_contributions() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$ BEGIN UPDATE public.employer_contributions SET status = ''overdue'', updated_at = now() WHERE status = ''pending'' AND due_date < CURRENT_DATE AND negotiation_id IS NULL; END; $fn$';
  END IF;
END $$;