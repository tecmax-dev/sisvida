ALTER TABLE public.patient_dependents
  ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE public.patient_dependents
  DROP CONSTRAINT IF EXISTS patient_dependents_gender_check;

ALTER TABLE public.patient_dependents
  ADD CONSTRAINT patient_dependents_gender_check
  CHECK (gender IS NULL OR lower(gender) IN ('masculino','feminino','outro'));

UPDATE public.patient_dependents d
SET gender = CASE
      WHEN lower(p.gender::text) IN ('f','feminino','female','mulher') THEN 'feminino'
      WHEN lower(p.gender::text) IN ('m','masculino','male','homem') THEN 'masculino'
      ELSE NULL END
FROM public.patients p
WHERE d.gender IS NULL
  AND p.cpf IS NOT NULL
  AND regexp_replace(p.cpf,'\D','','g') = regexp_replace(COALESCE(d.cpf,''),'\D','','g')
  AND length(regexp_replace(COALESCE(d.cpf,''),'\D','','g')) = 11
  AND p.gender IS NOT NULL;

UPDATE public.patient_dependents
SET gender = 'feminino'
WHERE gender IS NULL
  AND lower(COALESCE(relationship,'')) ~* '^(filha|irm[ãa]|av[óo]|neta|enteada|sobrinha|tia|prima|companheira|esposa|nora|madrasta|m[ãa]e|mother|daughter|wife)';

UPDATE public.patient_dependents
SET gender = 'masculino'
WHERE gender IS NULL
  AND lower(COALESCE(relationship,'')) ~* '^(filho|marido|esposo|pai|irm[ãa]o|av[ôo]|neto|enteado|sobrinho|tio|primo|companheiro|genro|padrasto|father|son|husband)';

CREATE OR REPLACE FUNCTION public.check_professional_gender_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    prof_name TEXT;
    patient_gender_val TEXT;
    dep_gender TEXT;
    dep_relationship TEXT;
    is_female BOOLEAN := FALSE;
BEGIN
    -- Só valida elegibilidade na criação ou quando muda paciente/dependente/profissional
    IF TG_OP = 'UPDATE' THEN
        IF NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
           AND NEW.dependent_id IS NOT DISTINCT FROM OLD.dependent_id
           AND NEW.professional_id IS NOT DISTINCT FROM OLD.professional_id THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT name INTO prof_name FROM public.professionals WHERE id = NEW.professional_id;

    IF prof_name IS NULL OR prof_name !~* 'karen\s+f(r)?eire' THEN
        RETURN NEW;
    END IF;

    IF NEW.dependent_id IS NULL THEN
        SELECT LOWER(COALESCE(gender::text, '')) INTO patient_gender_val
        FROM public.patients
        WHERE id = NEW.patient_id;

        IF patient_gender_val IN ('f', 'feminino', 'female', 'mulher') THEN
            is_female := TRUE;
        END IF;
    ELSE
        SELECT LOWER(COALESCE(gender, '')), LOWER(COALESCE(relationship, ''))
          INTO dep_gender, dep_relationship
        FROM public.patient_dependents
        WHERE id = NEW.dependent_id;

        IF dep_gender IN ('f', 'feminino', 'female', 'mulher') THEN
            is_female := TRUE;
        ELSIF dep_gender IN ('m', 'masculino', 'male', 'homem') THEN
            is_female := FALSE;
        ELSIF dep_relationship ~* '^(filha|irm[ãa]|av[óo]|neta|enteada|sobrinha|tia|prima|companheira|esposa|c[ôo]njuge feminin|nora|madrasta|m[ãa]e|mother|daughter|wife)' THEN
            is_female := TRUE;
        ELSE
            RAISE EXCEPTION 'Não foi possível confirmar o sexo do dependente. Informe o sexo no cadastro do dependente para agendar com esta profissional.';
        END IF;
    END IF;

    IF NOT is_female THEN
        RAISE EXCEPTION 'Atendimento exclusivo para mulheres.';
    END IF;

    RETURN NEW;
END;
$function$;