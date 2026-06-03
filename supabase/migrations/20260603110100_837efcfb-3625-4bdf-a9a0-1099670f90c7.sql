DROP POLICY IF EXISTS "Clinic users can view their notifications" ON public.negotiation_installment_notifications;

CREATE POLICY "Clinic users can view their notifications"
ON public.negotiation_installment_notifications
FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Only admins can manage templates" ON public.whatsapp_templates;

CREATE POLICY "Admins can manage templates"
ON public.whatsapp_templates
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin')
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin')
  )
);