
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_gender') THEN
        CREATE TYPE public.patient_gender AS ENUM ('masculino', 'feminino', 'outro', 'prefiro_nao_dizer');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_professional_gender_restriction()
RETURNS TRIGGER AS $$
DECLARE
    prof_name TEXT;
    patient_gender_val TEXT;
    dep_relationship TEXT;
    is_female BOOLEAN := FALSE;
BEGIN
    -- 1. Identificar a profissional
    SELECT name INTO prof_name FROM public.professionals WHERE id = NEW.professional_id;
    
    -- 2. Se não for Karen Feire/Freire, permite qualquer agendamento
    IF prof_name IS NULL OR prof_name !~* 'karen\s+f(r)?eire' THEN
        RETURN NEW;
    END IF;

    -- 3. Validar gênero
    -- Caso Titular: busca no perfil
    IF NEW.dependent_id IS NULL THEN
        SELECT LOWER(COALESCE(gender, sexo, '')) INTO patient_gender_val 
        FROM public.profiles 
        WHERE id = NEW.patient_id;
        
        IF patient_gender_val IN ('f', 'feminino', 'female', 'mulher') THEN
            is_female := TRUE;
        END IF;
    -- Caso Dependente: busca na tabela de dependentes
    ELSE
        SELECT LOWER(COALESCE(relationship, '')) INTO dep_relationship 
        FROM public.sindical_dependentes 
        WHERE id = NEW.dependent_id;
        
        -- Heurística baseada em termos femininos de parentesco
        IF dep_relationship ~* '^(filha|irm[ãa]|av[óo]|neta|enteada|sobrinha|tia|prima|companheira|nora|madrasta)\b' THEN
            is_female := TRUE;
        END IF;
    END IF;

    -- 4. Bloqueio definitivo no banco
    IF NOT is_female THEN
        RAISE EXCEPTION 'Atendimento exclusivo para mulheres.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar o trigger
DROP TRIGGER IF EXISTS trg_check_professional_gender_restriction ON public.appointments;
CREATE TRIGGER trg_check_professional_gender_restriction
    BEFORE INSERT OR UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.check_professional_gender_restriction();

-- Garantir privilégios
GRANT EXECUTE ON FUNCTION public.check_professional_gender_restriction() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_professional_gender_restriction() TO service_role;
