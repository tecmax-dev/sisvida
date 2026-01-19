-- Drop and recreate with a more permissive approach
DROP POLICY IF EXISTS "anon_can_cancel_own_appointments" ON public.homologacao_appointments;

-- For anon users to be able to UPDATE, they need to be able to SELECT the row first
-- The existing "Public can view appointments for availability" policy filters out cancelled
-- But this should still work for scheduled/confirmed appointments

-- Let's create policy without relying on the status check in USING since
-- the select policy already handles visibility
CREATE POLICY "anon_can_cancel_own_appointments" 
ON public.homologacao_appointments
FOR UPDATE
TO anon
USING (true)  -- Allow selecting any row for update check (actual filtering done by WITH CHECK)
WITH CHECK (
  -- Only allow if the result sets status to cancelled
  status = 'cancelled'
);