CREATE OR REPLACE FUNCTION public.update_own_dependent_gender(p_dependent_id uuid, p_gender text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_gender NOT IN ('masculino', 'feminino', 'outro') THEN
    RAISE EXCEPTION 'Sexo inválido.';
  END IF;

  UPDATE public.patient_dependents
  SET gender = p_gender
  WHERE id = p_dependent_id
    AND public.is_current_patient(patient_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dependente não encontrado ou sem permissão.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_dependent_gender(uuid, text) TO authenticated;