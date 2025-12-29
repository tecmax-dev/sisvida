-- Add column to enable CPF per month restriction
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS restrict_one_appointment_per_cpf_month boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.clinics.restrict_one_appointment_per_cpf_month IS 'When enabled, restricts one appointment per CPF per month per professional';

-- Create function to validate appointment restriction
CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  clinic_restrict BOOLEAN;
  patient_cpf TEXT;
  existing_count INTEGER;
  month_start DATE;
  month_end DATE;
BEGIN
  -- Check if clinic has restriction enabled
  SELECT restrict_one_appointment_per_cpf_month INTO clinic_restrict
  FROM clinics
  WHERE id = NEW.clinic_id;
  
  -- If restriction is disabled, allow
  IF clinic_restrict = FALSE OR clinic_restrict IS NULL THEN
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
  
  -- Check for existing appointments in the same month for the same professional
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
  
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_CPF: Este paciente já possui um agendamento com este profissional neste mês.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for validation
DROP TRIGGER IF EXISTS validate_appointment_cpf_restriction_trigger ON appointments;
CREATE TRIGGER validate_appointment_cpf_restriction_trigger
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION validate_appointment_cpf_restriction();