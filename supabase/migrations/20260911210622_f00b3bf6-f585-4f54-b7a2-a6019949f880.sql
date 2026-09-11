GRANT SELECT, UPDATE ON public.whatsapp_consents TO authenticated;

CREATE POLICY "Clinic staff can read whatsapp consents"
ON public.whatsapp_consents FOR SELECT TO authenticated
USING (tenant_id IS NOT NULL AND public.has_clinic_access(auth.uid(), tenant_id));

CREATE POLICY "Clinic staff can revoke whatsapp consents"
ON public.whatsapp_consents FOR UPDATE TO authenticated
USING (tenant_id IS NOT NULL AND public.has_clinic_access(auth.uid(), tenant_id))
WITH CHECK (tenant_id IS NOT NULL AND public.has_clinic_access(auth.uid(), tenant_id));