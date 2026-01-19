-- Corrigir política de cancelamento: permitir atualização de múltiplas colunas
-- O problema é que WITH CHECK só validava status, mas o app atualiza outras colunas também

DROP POLICY IF EXISTS "allow_cancel_scheduled_appointments" ON public.homologacao_appointments;

-- Nova política mais flexível: 
-- USING: linha original deve ter status scheduled/confirmed
-- WITH CHECK: linha nova deve ter status cancelled (independente das outras colunas)
CREATE POLICY "allow_cancel_scheduled_appointments"
ON public.homologacao_appointments
FOR UPDATE
TO anon, authenticated
USING (status IN ('scheduled', 'confirmed'))
WITH CHECK (status = 'cancelled');