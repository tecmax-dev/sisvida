-- Ajuste: garantir booleano (evitar NULL) nas checagens de acesso

DROP POLICY IF EXISTS "update_homologacao_appointments_by_clinic_access" ON public.homologacao_appointments;
DROP POLICY IF EXISTS "allow_authenticated_cancel_own_appointments" ON public.homologacao_appointments;

CREATE POLICY "update_homologacao_appointments_by_clinic_access"
ON public.homologacao_appointments
FOR UPDATE
TO authenticated
USING (coalesce(has_union_homologacao_access(auth.uid(), clinic_id), false))
WITH CHECK (coalesce(has_union_homologacao_access(auth.uid(), clinic_id), false));

CREATE POLICY "allow_authenticated_cancel_own_appointments"
ON public.homologacao_appointments
FOR UPDATE
TO authenticated
USING (
  status IN ('scheduled', 'confirmed')
  AND NOT coalesce(has_union_homologacao_access(auth.uid(), clinic_id), false)
)
WITH CHECK (
  status = 'cancelled'
  AND NOT coalesce(has_union_homologacao_access(auth.uid(), clinic_id), false)
);