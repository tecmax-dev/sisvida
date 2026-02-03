-- Allow public to verify employer exists for FK validation on filiacao forms
-- This is needed because FK constraints check with invoking user's privileges
CREATE POLICY "Public can verify employer exists for filiacao"
ON public.employers
FOR SELECT
TO anon, authenticated
USING (true);