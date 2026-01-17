-- Allow public (anon) access to active union entities for the public affiliation page
CREATE POLICY "Public can view active union entities for affiliation"
ON public.union_entities
FOR SELECT
TO anon
USING (status = 'ativa');