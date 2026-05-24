
-- 1. whatsapp_audit_logs
DROP POLICY IF EXISTS "Audit logs are viewable by authenticated users" ON public.whatsapp_audit_logs;
CREATE POLICY "Super admins can view whatsapp audit logs"
ON public.whatsapp_audit_logs FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 2. whatsapp_sessions
DROP POLICY IF EXISTS "Service role can do everything on whatsapp_sessions" ON public.whatsapp_sessions;
CREATE POLICY "Service role full access on whatsapp_sessions"
ON public.whatsapp_sessions FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 3. zapresponder_configs
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.zapresponder_configs;
DROP POLICY IF EXISTS "Users can manage their clinic zapresponder config" ON public.zapresponder_configs;
CREATE POLICY "Clinic admins manage zapresponder configs"
ON public.zapresponder_configs FOR ALL TO authenticated
USING (public.is_clinic_admin(auth.uid(), clinic_id))
WITH CHECK (public.is_clinic_admin(auth.uid(), clinic_id));
CREATE POLICY "Service role full access on zapresponder_configs"
ON public.zapresponder_configs FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 4. clinics column-level for anon
REVOKE SELECT ON public.clinics FROM anon;
GRANT SELECT (
  id, name, slug, logo_url, phone, email, address, city, state_code,
  opening_time, closing_time, entity_nomenclature, custom_map_embed_url,
  map_view_type, booking_months_ahead, min_advance_booking_hours,
  max_appointments_per_cpf_month, holidays_enabled, birthday_enabled,
  reminder_enabled, reminder_hours, is_blocked, app_unavailable,
  app_unavailable_message, created_at, updated_at
) ON public.clinics TO anon;

-- 5. professionals column-level for anon
REVOKE SELECT ON public.professionals FROM anon;
GRANT SELECT (
  id, clinic_id, name, specialty, avatar_url, bio, slug, is_active,
  created_at, updated_at
) ON public.professionals TO anon;

-- 6. union_entities
DROP POLICY IF EXISTS "Anon can verify union entity exists for filiacao FK" ON public.union_entities;
REVOKE SELECT ON public.union_entities FROM anon;
GRANT SELECT (
  id, clinic_id, nome_fantasia, razao_social, logo_url, status,
  cidade, estado, endereco, entity_type, categoria_laboral,
  allowed_relationship_types, created_at, updated_at
) ON public.union_entities TO anon;

-- 7. contribution_types
DROP POLICY IF EXISTS "Public can view contribution types by token context" ON public.contribution_types;

-- 8. Views invoker
ALTER VIEW public.public_clinic_info SET (security_invoker = on);
ALTER VIEW public.public_professionals SET (security_invoker = on);

-- 9. whazing_messages: remove from realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.whazing_messages;

-- 10. Storage: dependent-documents
DROP POLICY IF EXISTS "Authenticated can view dependent documents" ON storage.objects;
CREATE POLICY "Clinic members can view dependent documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'dependent-documents'
  AND EXISTS (
    SELECT 1
    FROM public.patient_dependents pd
    JOIN public.patients p ON p.id = pd.patient_id
    WHERE public.has_clinic_access(auth.uid(), p.clinic_id)
      AND (
        storage.objects.name LIKE pd.id::text || '/%'
        OR storage.objects.name LIKE '%/' || pd.id::text || '/%'
        OR storage.objects.name LIKE p.clinic_id::text || '/%'
      )
  )
);

-- 11. Storage: patient-photos scoped via path
DROP POLICY IF EXISTS "Authenticated can view patient photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update patient photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete patient photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload patient photos" ON storage.objects;

CREATE POLICY "Clinic members can view patient photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-photos' AND public.user_has_clinic_storage_access(name));

CREATE POLICY "Clinic members can upload patient photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-photos' AND public.user_has_clinic_storage_access(name));

CREATE POLICY "Clinic members can update patient photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'patient-photos' AND public.user_has_clinic_storage_access(name));

CREATE POLICY "Clinic members can delete patient photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-photos' AND public.user_has_clinic_storage_access(name));
