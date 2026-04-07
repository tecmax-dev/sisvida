
-- Drop the restrictive anon SELECT policy
DROP POLICY IF EXISTS "Public can view limited appointment data" ON public.homologacao_appointments;

-- Allow anon to read appointment slots (needed to check availability and read back inserted rows)
CREATE POLICY "anon_can_select_homologacao_appointments"
ON public.homologacao_appointments
FOR SELECT
TO anon
USING (true);
