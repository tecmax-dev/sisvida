-- Function to enforce admin-only access to sensitive patient fields
CREATE OR REPLACE FUNCTION public.enforce_patient_sensitive_fields_admin_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow if user is clinic admin or super admin
  IF public.is_clinic_admin(auth.uid(), OLD.clinic_id) OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  
  -- Check if any sensitive field is being modified
  IF (OLD.max_appointments_per_month IS DISTINCT FROM NEW.max_appointments_per_month) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: Apenas administradores podem alterar o limite de consultas do paciente.';
  END IF;
  
  IF (OLD.no_show_blocked_until IS DISTINCT FROM NEW.no_show_blocked_until) OR
     (OLD.no_show_blocked_at IS DISTINCT FROM NEW.no_show_blocked_at) OR
     (OLD.no_show_blocked_professional_id IS DISTINCT FROM NEW.no_show_blocked_professional_id) OR
     (OLD.no_show_unblocked_at IS DISTINCT FROM NEW.no_show_unblocked_at) OR
     (OLD.no_show_unblocked_by IS DISTINCT FROM NEW.no_show_unblocked_by) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: Apenas administradores podem desbloquear pacientes.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce the restriction
DROP TRIGGER IF EXISTS enforce_patient_sensitive_fields ON public.patients;
CREATE TRIGGER enforce_patient_sensitive_fields
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_patient_sensitive_fields_admin_only();