-- Atualizar função de validação para permitir bypass por admins
-- Admins podem agendar múltiplas consultas por CPF/profissional no mesmo mês

-- Função auxiliar para verificar se usuário é admin da clínica
CREATE OR REPLACE FUNCTION public.is_clinic_admin(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.clinic_id = _clinic_id
      AND ur.role IN ('owner', 'admin')
      AND ur.access_group_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.super_admins sa
    WHERE sa.user_id = _user_id
  )
$$;

-- Função para validar limite de agendamento por CPF (POR PROFISSIONAL)
-- ADMINS podem bypassar esta restrição
CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clinic_limit INT;
  patient_limit INT;
  existing_count INT;
  month_start DATE;
  month_end DATE;
  current_user_id uuid;
  user_is_admin boolean;
BEGIN
  -- Only validate for new appointments or when changing date/professional
  IF TG_OP = 'UPDATE' AND 
     OLD.appointment_date = NEW.appointment_date AND 
     OLD.professional_id = NEW.professional_id AND
     OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip validation for cancelled or no_show
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Skip if there's a dependent (handled by separate trigger)
  IF NEW.dependent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if current user is admin - admins can bypass the limit
  current_user_id := auth.uid();
  IF current_user_id IS NOT NULL THEN
    user_is_admin := public.is_clinic_admin(current_user_id, NEW.clinic_id);
    IF user_is_admin THEN
      RETURN NEW; -- Admin bypass
    END IF;
  END IF;

  -- Get limits
  SELECT max_appointments_per_cpf_month INTO clinic_limit
  FROM clinics WHERE id = NEW.clinic_id;

  SELECT max_appointments_per_month INTO patient_limit
  FROM patients WHERE id = NEW.patient_id;

  -- Use patient limit if set, otherwise clinic limit
  -- 0 or NULL means unlimited
  IF patient_limit IS NOT NULL THEN
    IF patient_limit = 0 THEN
      RETURN NEW; -- Unlimited
    END IF;
    clinic_limit := patient_limit;
  ELSIF clinic_limit IS NULL OR clinic_limit = 0 THEN
    RETURN NEW; -- Unlimited
  END IF;

  -- Calculate month boundaries
  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;

  -- Count existing appointments for THIS PROFESSIONAL in the month
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.patient_id = NEW.patient_id
    AND a.professional_id = NEW.professional_id
    AND a.dependent_id IS NULL
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (TG_OP = 'INSERT' OR a.id != NEW.id);

  IF existing_count >= clinic_limit THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_CPF: Já existe agendamento para este profissional neste mês';
  END IF;

  RETURN NEW;
END;
$$;

-- Função para validar limite de agendamento por dependente (POR PROFISSIONAL)
-- ADMINS podem bypassar esta restrição
CREATE OR REPLACE FUNCTION public.validate_dependent_appointment_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clinic_limit INT;
  existing_count INT;
  month_start DATE;
  month_end DATE;
  current_user_id uuid;
  user_is_admin boolean;
BEGIN
  -- Only validate if there's a dependent
  IF NEW.dependent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only validate for new appointments or when changing date/professional/status
  IF TG_OP = 'UPDATE' AND 
     OLD.appointment_date = NEW.appointment_date AND 
     OLD.professional_id = NEW.professional_id AND
     OLD.dependent_id = NEW.dependent_id AND
     OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Skip validation for cancelled or no_show
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Check if current user is admin - admins can bypass the limit
  current_user_id := auth.uid();
  IF current_user_id IS NOT NULL THEN
    user_is_admin := public.is_clinic_admin(current_user_id, NEW.clinic_id);
    IF user_is_admin THEN
      RETURN NEW; -- Admin bypass
    END IF;
  END IF;

  -- Get clinic limit (dependents always use clinic limit, default 1)
  SELECT COALESCE(max_appointments_per_cpf_month, 1) INTO clinic_limit
  FROM clinics WHERE id = NEW.clinic_id;

  -- 0 means unlimited
  IF clinic_limit = 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate month boundaries
  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;

  -- Count existing appointments for THIS DEPENDENT with THIS PROFESSIONAL in the month
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.dependent_id = NEW.dependent_id
    AND a.professional_id = NEW.professional_id
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (TG_OP = 'INSERT' OR a.id != NEW.id);

  IF existing_count >= clinic_limit THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_DEPENDENTE: Já existe agendamento para este dependente com este profissional neste mês';
  END IF;

  RETURN NEW;
END;
$$;