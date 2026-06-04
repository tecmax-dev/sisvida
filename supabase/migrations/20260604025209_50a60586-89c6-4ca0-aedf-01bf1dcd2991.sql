
DROP POLICY IF EXISTS "Union users manage sms templates" ON public.sms_templates;
DROP POLICY IF EXISTS "Union users view sms logs" ON public.sms_send_logs;
DROP POLICY IF EXISTS "Union users insert sms logs" ON public.sms_send_logs;

CREATE POLICY "Union users manage sms templates" ON public.sms_templates FOR ALL TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_union_entity_access(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id IS NOT NULL AND has_union_module_access(auth.uid(), ur.clinic_id))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_union_entity_access(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id IS NOT NULL AND has_union_module_access(auth.uid(), ur.clinic_id))
);

CREATE POLICY "Union users view sms logs" ON public.sms_send_logs FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_union_entity_access(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id IS NOT NULL AND has_union_module_access(auth.uid(), ur.clinic_id))
);

CREATE POLICY "Union users insert sms logs" ON public.sms_send_logs FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_union_entity_access(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id IS NOT NULL AND has_union_module_access(auth.uid(), ur.clinic_id))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT SELECT, INSERT ON public.sms_send_logs TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;
GRANT ALL ON public.sms_send_logs TO service_role;
