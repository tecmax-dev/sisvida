-- Add dependent_id to appointments to track appointments for dependents
ALTER TABLE public.appointments 
ADD COLUMN dependent_id uuid REFERENCES public.patient_dependents(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_appointments_dependent_id ON public.appointments(dependent_id) WHERE dependent_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.appointments.dependent_id IS 'If set, this appointment is for a dependent of the patient';

-- Create function to validate dependent card for appointments
CREATE OR REPLACE FUNCTION public.validate_dependent_card_for_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dependent RECORD;
BEGIN
  -- Skip if no dependent
  IF NEW.dependent_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip validation for cancellations and completed appointments
  IF NEW.status IN ('cancelled', 'completed', 'no_show') THEN
    RETURN NEW;
  END IF;
  
  -- Get dependent info
  SELECT card_expires_at, name INTO v_dependent
  FROM patient_dependents
  WHERE id = NEW.dependent_id AND is_active = true;
  
  -- If dependent not found or inactive
  IF v_dependent IS NULL THEN
    RAISE EXCEPTION 'DEPENDENTE_INVALIDO: O dependente selecionado não está ativo ou não existe.';
  END IF;
  
  -- Check if dependent has expired card
  IF v_dependent.card_expires_at IS NOT NULL AND v_dependent.card_expires_at < now() THEN
    RAISE EXCEPTION 'CARTEIRINHA_DEPENDENTE_VENCIDA: A carteirinha do dependente (%) expirou em %. Por favor, renove a carteirinha para agendar.', 
      v_dependent.name, 
      to_char(v_dependent.card_expires_at, 'DD/MM/YYYY');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for dependent card validation
CREATE TRIGGER validate_dependent_card_trigger
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.validate_dependent_card_for_appointment();