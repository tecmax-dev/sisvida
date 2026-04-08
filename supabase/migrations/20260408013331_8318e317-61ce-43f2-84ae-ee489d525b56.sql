
-- Fix professional_schedule_exceptions: restrict to authenticated
DROP POLICY IF EXISTS "Public can view schedule exceptions for booking" ON public.professional_schedule_exceptions;
CREATE POLICY "Authenticated can view schedule exceptions"
ON public.professional_schedule_exceptions
FOR SELECT
TO authenticated
USING (true);

-- Fix sindical_associado_dependentes: add associado_id validation for anon inserts
DROP POLICY IF EXISTS "Public can insert dependentes via form" ON public.sindical_associado_dependentes;
CREATE POLICY "Public can insert dependentes via form"
ON public.sindical_associado_dependentes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sindical_associados sa
    WHERE sa.id = sindical_associado_dependentes.associado_id
  )
);
