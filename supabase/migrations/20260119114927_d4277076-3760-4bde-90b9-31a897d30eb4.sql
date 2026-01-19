-- Remove as políticas atuais de UPDATE
DROP POLICY IF EXISTS "allow_mobile_cancel_appointments" ON public.homologacao_appointments;
DROP POLICY IF EXISTS "update_homologacao_appointments_by_clinic_access" ON public.homologacao_appointments;

-- Política para staff da clínica (authenticated com acesso)
-- Permite qualquer update
CREATE POLICY "update_homologacao_appointments_by_clinic_access"
ON public.homologacao_appointments
FOR UPDATE
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id))
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- Política para cancelamento via app móvel (anon)
-- Permite apenas mudar status para 'cancelled' em agendamentos scheduled/confirmed
CREATE POLICY "allow_anon_cancel_appointments"
ON public.homologacao_appointments
FOR UPDATE
TO anon
USING (status IN ('scheduled', 'confirmed'))
WITH CHECK (status = 'cancelled');

-- Política para cancelamento via app móvel (authenticated SEM acesso à clínica)
-- Permite apenas mudar status para 'cancelled' em agendamentos scheduled/confirmed
-- Só se aplica quando o usuário NÃO tem acesso de staff
CREATE POLICY "allow_authenticated_cancel_own_appointments"
ON public.homologacao_appointments
FOR UPDATE
TO authenticated
USING (
  status IN ('scheduled', 'confirmed')
  AND NOT has_union_homologacao_access(auth.uid(), clinic_id)
)
WITH CHECK (
  status = 'cancelled'
  AND NOT has_union_homologacao_access(auth.uid(), clinic_id)
);