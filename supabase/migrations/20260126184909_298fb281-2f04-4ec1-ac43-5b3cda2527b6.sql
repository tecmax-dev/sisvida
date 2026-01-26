-- Criar função SECURITY DEFINER para validar se paciente pode criar autorização
CREATE OR REPLACE FUNCTION public.can_patient_create_authorization(p_patient_id uuid, p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients p
    JOIN public.patient_cards pc ON pc.patient_id = p.id
    WHERE p.id = p_patient_id
      AND p.is_active = true
      AND pc.clinic_id = p_clinic_id
      AND pc.is_active = true
  )
$$;

-- Remover policy problemática que depende de JWT metadata
DROP POLICY IF EXISTS "Patients (authenticated) can create self-service authorizations" ON public.union_authorizations;

-- Criar nova policy robusta para pacientes autenticados
CREATE POLICY "Patients can create own authorizations"
ON public.union_authorizations
FOR INSERT
TO authenticated
WITH CHECK (
  patient_id IS NOT NULL
  AND created_by IS NOT NULL
  AND created_by = patient_id
  AND public.can_patient_create_authorization(patient_id, clinic_id)
);