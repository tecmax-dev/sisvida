-- Add policy for public read access to union_benefits for validation
CREATE POLICY "Public can read benefits for authorization validation"
ON public.union_benefits
FOR SELECT
USING (true);