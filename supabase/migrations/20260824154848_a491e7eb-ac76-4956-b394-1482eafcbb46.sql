CREATE OR REPLACE FUNCTION public.check_professional_gender_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    prof_name TEXT;
    patient_gender_val TEXT;
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
        SELECT LOWER(COALESCE(relationship, '')) INTO dep_relationship
        FROM public.patient_dependents
        WHERE id = NEW.dependent_id;

        IF dep_relationship ~* '^(filha|irm[ãa]|av[óo]|neta|enteada|sobrinha|tia|prima|companheira|esposa|c[ôo]njuge feminin|nora|madrasta|m[ãa]e)\b' THEN
            is_female := TRUE;
        END IF;
    END IF;

    IF NOT is_female THEN
        RAISE EXCEPTION 'Atendimento exclusivo para mulheres.';
    END IF;

    RETURN NEW;
END;
$$;