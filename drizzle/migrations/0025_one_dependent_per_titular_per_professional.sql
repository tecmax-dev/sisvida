CREATE OR REPLACE FUNCTION public.validate_dependent_appointment_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean; v_period text; v_limit int;
  v_start DATE; v_end DATE; v_week_start DATE; v_week_end DATE;
  same_dep INT; family_week INT; family_period INT; current_user_id uuid; user_is_admin boolean;
BEGIN
  IF NEW.dependent_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.appointment_date = NEW.appointment_date AND
     OLD.professional_id = NEW.professional_id AND OLD.dependent_id = NEW.dependent_id AND
     OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('cancelled', 'no_show') THEN RETURN NEW; END IF;

  SELECT COALESCE(dependent_booking_limit_enabled, true), COALESCE(dependent_booking_period, 'monthly'), COALESCE(dependent_booking_limit, 1)
  INTO v_enabled, v_period, v_limit FROM clinics WHERE id = NEW.clinic_id;
  IF NOT v_enabled THEN RETURN NEW; END IF;

  current_user_id := auth.uid();
  IF current_user_id IS NOT NULL THEN
    user_is_admin := public.is_clinic_admin(current_user_id, NEW.clinic_id);
    IF user_is_admin THEN RETURN NEW; END IF;
  END IF;

  SELECT b.p_start, b.p_end INTO v_start, v_end FROM public.booking_period_bounds(v_period, NEW.appointment_date) b;

  IF v_limit > 0 THEN
    SELECT COUNT(*) INTO same_dep FROM appointments a
    WHERE a.clinic_id = NEW.clinic_id AND a.dependent_id = NEW.dependent_id
      AND a.professional_id = NEW.professional_id
      AND a.appointment_date BETWEEN v_start AND v_end
      AND a.status NOT IN ('cancelled', 'no_show')
      AND (TG_OP = 'INSERT' OR a.id != NEW.id);
    IF same_dep >= v_limit THEN
      IF v_period ~ '^days_' THEN
        RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: Este dependente já atingiu o limite com este profissional. Limite: % a cada % dias por dependente.', v_limit, substring(v_period from 6);
      END IF;
      RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: Este dependente já possui um agendamento com este profissional neste mês. Limite: % por mês por dependente.', v_limit;
    END IF;
  END IF;

  -- Apenas 1 dependente do mesmo titular por profissional no período configurado
  SELECT COUNT(*) INTO family_period FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id AND a.patient_id = NEW.patient_id
    AND a.dependent_id IS NOT NULL AND a.dependent_id <> NEW.dependent_id
    AND a.professional_id = NEW.professional_id
    AND a.appointment_date BETWEEN v_start AND v_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (TG_OP = 'INSERT' OR a.id != NEW.id);
  IF family_period >= 1 THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: Outro dependente deste titular já tem agendamento com este profissional no período. Apenas 1 dependente por titular para cada profissional.';
  END IF;

  v_week_start := date_trunc('week', NEW.appointment_date)::date;
  v_week_end   := (date_trunc('week', NEW.appointment_date) + interval '6 days')::date;
  SELECT COUNT(*) INTO family_week FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id AND a.patient_id = NEW.patient_id AND a.dependent_id IS NOT NULL
    AND a.professional_id = NEW.professional_id
    AND a.appointment_date BETWEEN v_week_start AND v_week_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (TG_OP = 'INSERT' OR a.id != NEW.id);
  IF family_week >= 1 THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: Já existe agendamento de um dependente deste titular com este profissional nesta semana. Limite: 1 dependente por semana por profissional.';
  END IF;
  RETURN NEW;
END;
$function$;