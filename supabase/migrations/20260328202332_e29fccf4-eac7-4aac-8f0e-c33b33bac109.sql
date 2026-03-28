-- FIX 1: Remove anonymous full read access to patients table
DROP POLICY IF EXISTS "Anon can read patients for mobile app" ON public.patients;

-- FIX 2: Fix patient_first_access_tokens exposure
DROP POLICY IF EXISTS "Service role can manage first access tokens" ON public.patient_first_access_tokens;
DROP POLICY IF EXISTS "First access tokens not publicly readable" ON public.patient_first_access_tokens;

CREATE POLICY "Service role only manages first access tokens"
ON public.patient_first_access_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "First access tokens not publicly readable"
ON public.patient_first_access_tokens
FOR SELECT
TO anon, authenticated
USING (false);

-- FIX 3: Fix whatsapp_boleto_sessions exposure
DROP POLICY IF EXISTS "Service role can manage boleto sessions" ON public.whatsapp_boleto_sessions;

CREATE POLICY "Service role only manages boleto sessions"
ON public.whatsapp_boleto_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Boleto sessions not publicly readable"
ON public.whatsapp_boleto_sessions
FOR SELECT
TO anon, authenticated
USING (false);