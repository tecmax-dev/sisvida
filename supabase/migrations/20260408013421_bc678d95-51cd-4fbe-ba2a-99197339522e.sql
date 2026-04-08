
-- The public_clinic_info view already restricts which columns are exposed.
-- Restore anon SELECT access since public booking pages need clinic data.
DROP POLICY IF EXISTS "Public can view clinic basic info by slug" ON public.clinics;
CREATE POLICY "Public can view clinic basic info by slug"
ON public.clinics
FOR SELECT
USING (true);
