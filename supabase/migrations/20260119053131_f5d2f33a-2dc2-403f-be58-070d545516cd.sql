-- Fix: cancellation from app may run as authenticated session (persisted login)
-- so policy must apply to both anon and authenticated.

DROP POLICY IF EXISTS "anon_can_cancel_own_appointments" ON public.homologacao_appointments;

CREATE POLICY "anon_can_cancel_own_appointments"
ON public.homologacao_appointments
FOR UPDATE
TO anon, authenticated
USING (
  status IN ('scheduled','confirmed')
)
WITH CHECK (
  status = 'cancelled'
);
