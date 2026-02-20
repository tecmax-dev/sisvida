
-- Allow anonymous access to employer_contributions via public_access_token
-- This is needed for the public contribution value page (/contribuicao/:token)
CREATE POLICY "Public can view contributions by token"
ON public.employer_contributions
FOR SELECT
TO anon
USING (public_access_token IS NOT NULL);
