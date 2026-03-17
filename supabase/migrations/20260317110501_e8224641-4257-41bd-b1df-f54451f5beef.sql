CREATE OR REPLACE FUNCTION public.check_patient_has_password(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT password_hash IS NOT NULL
  FROM public.patients
  WHERE id = p_patient_id
  LIMIT 1;
$$;