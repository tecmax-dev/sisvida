-- Add no-show blocking columns to patients table
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS no_show_blocked_until DATE,
ADD COLUMN IF NOT EXISTS no_show_blocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS no_show_unblocked_by UUID,
ADD COLUMN IF NOT EXISTS no_show_unblocked_at TIMESTAMPTZ;

-- Create function to automatically block patient on no-show
CREATE OR REPLACE FUNCTION public.handle_no_show_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  block_end_date DATE;
BEGIN
  -- Only process when status changes TO 'no_show'
  IF NEW.status = 'no_show' AND (OLD.status IS NULL OR OLD.status != 'no_show') THEN
    -- Calculate block end: end of current month + 1 month
    -- If no-show happens in January, block until end of February
    block_end_date := (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day')::date;
    
    -- Update patient with block info
    UPDATE patients
    SET 
      no_show_blocked_until = block_end_date,
      no_show_blocked_at = NOW(),
      no_show_unblocked_by = NULL,
      no_show_unblocked_at = NULL
    WHERE id = NEW.patient_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for no-show blocking
DROP TRIGGER IF EXISTS trigger_no_show_block ON appointments;
CREATE TRIGGER trigger_no_show_block
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION handle_no_show_block();

-- Update appointment validation to check for no-show blocks
CREATE OR REPLACE FUNCTION public.validate_appointment_cpf_restriction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  max_appointments INTEGER;
  patient_cpf TEXT;
  existing_count INTEGER;
  month_start DATE;
  month_end DATE;
  patient_blocked_until DATE;
  patient_unblocked_at TIMESTAMPTZ;
BEGIN
  -- Skip validation for cancellations and no_show appointments
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Skip validation on UPDATE if status is changing to cancelled/no_show
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Check for no-show block on patient
  SELECT no_show_blocked_until, no_show_unblocked_at 
  INTO patient_blocked_until, patient_unblocked_at
  FROM patients
  WHERE id = NEW.patient_id;
  
  -- If patient is blocked and not unblocked by admin
  IF patient_blocked_until IS NOT NULL 
     AND patient_blocked_until >= CURRENT_DATE 
     AND patient_unblocked_at IS NULL THEN
    RAISE EXCEPTION 'PACIENTE_BLOQUEADO_NO_SHOW: Este paciente está bloqueado para agendamentos até % devido a não comparecimento. Solicite liberação ao administrador.', to_char(patient_blocked_until, 'DD/MM/YYYY');
  END IF;

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
  
  -- Calculate month boundaries for the NEW appointment date
  month_start := date_trunc('month', NEW.appointment_date)::date;
  month_end := (date_trunc('month', NEW.appointment_date) + interval '1 month' - interval '1 day')::date;
  
  -- Count existing appointments in the same month for the same professional
  -- Exclude only cancelled and no_show from the count (completed counts!)
  SELECT COUNT(*) INTO existing_count
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.clinic_id = NEW.clinic_id
    AND a.professional_id = NEW.professional_id
    AND a.appointment_date >= month_start
    AND a.appointment_date <= month_end
    AND p.cpf = patient_cpf
    AND a.status NOT IN ('cancelled', 'no_show')
    AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count >= max_appointments THEN
    RAISE EXCEPTION 'LIMITE_AGENDAMENTO_CPF: Este paciente já atingiu o limite de % agendamento(s) com este profissional neste mês.', max_appointments;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Comment for documentation
COMMENT ON COLUMN patients.no_show_blocked_until IS 'Data até quando o paciente está bloqueado por não comparecimento';
COMMENT ON COLUMN patients.no_show_blocked_at IS 'Data/hora em que o bloqueio foi aplicado';
COMMENT ON COLUMN patients.no_show_unblocked_by IS 'ID do admin que liberou o bloqueio antecipadamente';
COMMENT ON COLUMN patients.no_show_unblocked_at IS 'Data/hora em que o admin liberou o bloqueio';