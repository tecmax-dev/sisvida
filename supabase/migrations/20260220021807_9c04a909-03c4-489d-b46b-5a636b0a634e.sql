
-- Allow anonymous access to contribution_types for the public contribution page
CREATE POLICY "Public can view contribution types by token context"
ON public.contribution_types
FOR SELECT
TO anon
USING (true);
