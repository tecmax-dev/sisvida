-- Drop the problematic policy
DROP POLICY IF EXISTS "anon_can_cancel_own_appointments" ON public.homologacao_appointments;

-- Create a corrected policy that allows anon to update to cancelled status
-- The USING clause must be true for the row to be selected for update
-- The WITH CHECK validates the NEW row after update
CREATE POLICY "anon_can_cancel_own_appointments" 
ON public.homologacao_appointments
FOR UPDATE
TO anon
USING (
  -- Only allow updating appointments that are scheduled or confirmed (not already cancelled)
  status IN ('scheduled', 'confirmed')
)
WITH CHECK (
  -- Only allow setting status to cancelled
  status = 'cancelled'
);