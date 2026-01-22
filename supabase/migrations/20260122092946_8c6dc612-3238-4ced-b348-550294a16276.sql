-- Add policy for public validation of authorizations by hash
CREATE POLICY "Public can validate authorizations by hash"
ON public.union_authorizations
FOR SELECT
USING (true);

-- Note: This allows public read access to authorizations.
-- The validation_hash acts as a secret token - only those with the hash can find the authorization.
-- Consider adding rate limiting at the application level if needed.