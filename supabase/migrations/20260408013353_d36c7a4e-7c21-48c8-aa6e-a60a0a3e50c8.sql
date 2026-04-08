
-- Fix homologacao_appointments: scope anon SELECT to token-based access
DROP POLICY IF EXISTS "anon_can_select_homologacao_appointments" ON public.homologacao_appointments;
CREATE POLICY "anon_can_select_homologacao_appointments"
ON public.homologacao_appointments
FOR SELECT
USING (
  confirmation_token IS NOT NULL 
  AND confirmation_token = (current_setting('request.headers', true)::json->>'x-confirmation-token')::uuid
);

-- Fix clinics: allow authenticated users full access, anon only by slug header
DROP POLICY IF EXISTS "Public can view clinic basic info by slug" ON public.clinics;
CREATE POLICY "Public can view clinic basic info by slug"
ON public.clinics
FOR SELECT
USING (
  slug = current_setting('request.headers', true)::json->>'x-clinic-slug'
  OR (auth.uid() IS NOT NULL)
);
