-- Remover todas as políticas de UPDATE existentes
DROP POLICY IF EXISTS "update_homologacao_appointments_by_clinic_access" ON public.homologacao_appointments;
DROP POLICY IF EXISTS "allow_anon_cancel_appointments" ON public.homologacao_appointments;
DROP POLICY IF EXISTS "allow_authenticated_cancel_own_appointments" ON public.homologacao_appointments;
DROP POLICY IF EXISTS "allow_mobile_cancel_appointments" ON public.homologacao_appointments;

-- Criar UMA única política de UPDATE que cobre todos os casos
-- Staff da clínica pode fazer qualquer update
-- Não-staff (anon ou authenticated) pode apenas cancelar agendamentos scheduled/confirmed
CREATE POLICY "update_homologacao_appointments_unified"
ON public.homologacao_appointments
FOR UPDATE
TO anon, authenticated
USING (
  -- Staff tem acesso total OU é um agendamento que pode ser cancelado
  COALESCE(has_union_homologacao_access(auth.uid(), clinic_id), false)
  OR status IN ('scheduled', 'confirmed')
)
WITH CHECK (
  -- Staff pode fazer qualquer alteração
  COALESCE(has_union_homologacao_access(auth.uid(), clinic_id), false)
  OR (
    -- Não-staff só pode cancelar
    status = 'cancelled'
  )
);