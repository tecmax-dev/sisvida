GRANT SELECT ON public.whatsapp_templates TO anon;
DROP POLICY IF EXISTS "Templates are publicly viewable" ON public.whatsapp_templates;
CREATE POLICY "Templates are publicly viewable"
ON public.whatsapp_templates
FOR SELECT
TO anon, authenticated
USING (true);