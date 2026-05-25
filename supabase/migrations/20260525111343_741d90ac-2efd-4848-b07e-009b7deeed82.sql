
CREATE OR REPLACE FUNCTION public.enforce_biolife_authorization_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_benefit RECORD;
  v_patient RECORD;
  v_last_issued timestamptz;
  v_is_biolife boolean;
  v_gender text;
BEGIN
  SELECT name, partner_name, category INTO v_benefit
  FROM public.union_benefits WHERE id = NEW.benefit_id;

  IF v_benefit IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_biolife :=
    lower(coalesce(v_benefit.name,'')) LIKE '%biolife%'
    OR lower(coalesce(v_benefit.partner_name,'')) LIKE '%biolife%'
    OR lower(coalesce(v_benefit.category,'')) LIKE '%biolife%';

  IF NOT v_is_biolife THEN
    RETURN NEW;
  END IF;

  -- Bloqueio: Biolife não pode ser emitido para dependentes
  IF coalesce(NEW.is_for_dependent, false) THEN
    RAISE EXCEPTION 'Biolife é exclusivo para titulares. Não é permitido emitir para dependentes.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bloqueio: titular precisa ser do sexo feminino
  SELECT gender INTO v_gender FROM public.patients WHERE id = NEW.patient_id;
  IF v_gender IS NULL
     OR NOT (lower(trim(v_gender)) = 'f' OR lower(trim(v_gender)) LIKE 'fem%') THEN
    RAISE EXCEPTION 'Biolife é destinado apenas a associadas do sexo feminino.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bloqueio: 1 autorização Biolife a cada 12 meses
  SELECT max(a.issued_at) INTO v_last_issued
  FROM public.union_authorizations a
  JOIN public.union_benefits b ON b.id = a.benefit_id
  WHERE a.patient_id = NEW.patient_id
    AND a.status <> 'revoked'
    AND (
      lower(coalesce(b.name,'')) LIKE '%biolife%'
      OR lower(coalesce(b.partner_name,'')) LIKE '%biolife%'
      OR lower(coalesce(b.category,'')) LIKE '%biolife%'
    );

  IF v_last_issued IS NOT NULL AND v_last_issued > (now() - interval '12 months') THEN
    RAISE EXCEPTION 'Biolife já emitido nos últimos 12 meses (última emissão: %). Limite: 1 a cada 12 meses.',
      to_char(v_last_issued, 'DD/MM/YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_biolife_authorization_rules ON public.union_authorizations;
CREATE TRIGGER trg_enforce_biolife_authorization_rules
BEFORE INSERT ON public.union_authorizations
FOR EACH ROW EXECUTE FUNCTION public.enforce_biolife_authorization_rules();
