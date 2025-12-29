-- Replace boolean with integer for configurable limit
ALTER TABLE public.clinics 
DROP COLUMN IF EXISTS restrict_one_appointment_per_cpf_month;

ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS max_appointments_per_cpf_month integer DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.clinics.max_appointments_per_cpf_month IS 'Maximum appointments per CPF per month per professional. NULL = unlimited';

-- Update function to use configurable limit
CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_appointments INTEGER;
  patient_cpf TEXT;
  existing_count INTEGER;
  month_start DATE;
  month_end DATE;
BEGIN
  -- Check if clinic has restriction configured
  SELECT max_appointments_per_cpf_month INTO max_appointments
  FROM clinics
  WHERE id = NEW.clinic_id;
  
  -- If no limit configured (NULL or 0), allow
  IF max_appointments IS NULL OR max_appointments = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Get patient CPF
  SELECT cpf INTO patient_cpf
  FROM patients
  WHERE id = NEW.patient_id;
  
  -- If no CPF, allow (can't validate)
  IF patient_cpf IS NULL OR patient_cpf = '' THEN
    RETURN NEW;
  END IF;
  
  -- Calculate month boundaries
  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;
  
  -- Count existing appointments in the same month for the same professional
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.clinic_id = NEW.clinic_id
    AND a.professional_id = NEW.professional_id
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND p.cpf = patient_cpf
    AND a.status NOT IN ('cancelled')
    AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count >= max_appointments THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_CPF: Este paciente já atingiu o limite de % agendamento(s) com este profissional neste mês.', max_appointments;
  END IF;
  
  RETURN NEW;
END;
$$;