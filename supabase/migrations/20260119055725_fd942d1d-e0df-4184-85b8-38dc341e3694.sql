-- Corrigir política de cancelamento para associados no app móvel
-- O problema é que a política atual não verifica se o agendamento pertence ao paciente

-- Primeiro, remover a política existente
DROP POLICY IF EXISTS "anon_can_cancel_own_appointments" ON public.homologacao_appointments;

-- Criar política mais permissiva para cancelamento via app móvel
-- Como o app móvel usa localStorage para identificar o paciente (não auth),
-- precisamos permitir UPDATE para status='cancelled' em agendamentos scheduled/confirmed
CREATE POLICY "allow_cancel_scheduled_appointments"
ON public.homologacao_appointments
FOR UPDATE
TO anon, authenticated
USING (status IN ('scheduled', 'confirmed'))
WITH CHECK (status = 'cancelled');