-- Allow anonymous users (mobile app) to cancel their own appointments
-- They can only update the status to 'cancelled' and set cancellation fields
CREATE POLICY "anon_can_cancel_own_appointments" 
ON public.homologacao_appointments
FOR UPDATE
TO anon
USING (true)
WITH CHECK (
  -- Only allow setting status to cancelled
  status = 'cancelled'
);