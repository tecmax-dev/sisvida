-- Remove a política atual de cancelamento
DROP POLICY IF EXISTS "allow_cancel_scheduled_appointments" ON public.homologacao_appointments;

-- Remove a política de update geral para authenticated (que causa conflito)
DROP POLICY IF EXISTS "update_homologacao_appointments_by_clinic_access" ON public.homologacao_appointments;

-- Recria política de update para authenticated com acesso à clínica
-- Essa política permite qualquer update (incluindo cancelamento) para staff da clínica
CREATE POLICY "update_homologacao_appointments_by_clinic_access"
ON public.homologacao_appointments
FOR UPDATE
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id))
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- Política específica para cancelamento via app (anon ou authenticated sem acesso à clínica)
-- Permite APENAS mudar status para 'cancelled' em agendamentos scheduled/confirmed
CREATE POLICY "allow_mobile_cancel_appointments"
ON public.homologacao_appointments
FOR UPDATE
TO anon, authenticated
USING (
  status IN ('scheduled', 'confirmed')
)
WITH CHECK (
  -- Só permite se o ÚNICO campo alterado for status E o novo valor for 'cancelled'
  status = 'cancelled'
);