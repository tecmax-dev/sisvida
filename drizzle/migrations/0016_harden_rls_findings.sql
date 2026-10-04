DROP POLICY IF EXISTS "Authenticated users can view opt-ins" ON public.whatsapp_opt_ins;
CREATE POLICY "Clinic members can view opt-ins" ON public.whatsapp_opt_ins FOR SELECT TO authenticated
USING (public.has_clinic_access(auth.uid(), clinic_id) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "System can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can insert conciliation logs" ON public.lytex_conciliation_logs;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.patient_notifications;

DROP POLICY IF EXISTS "Authenticated users can view queue assignments" ON public.whazing_queue_users;
CREATE POLICY "Users view own queue assignments" ON public.whazing_queue_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Feature permissions are readable by authenticated users" ON public.feature_permissions;
CREATE POLICY "Clinic users can read feature permissions" ON public.feature_permissions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can create clinics" ON public.clinics;
CREATE POLICY "Users without clinic can create one" ON public.clinics FOR INSERT TO authenticated
WITH CHECK (NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.clinic_id IS NOT NULL) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can upload signatures via token" ON storage.objects;
CREATE POLICY "Public can upload signatures via token" ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'anamnesis-signatures' AND EXISTS (
  SELECT 1 FROM public.anamnese_responses ar
  WHERE ar.id::text = (storage.foldername(objects.name))[1] AND ar.public_token IS NOT NULL));

DROP POLICY IF EXISTS "Public can view own signature" ON storage.objects;