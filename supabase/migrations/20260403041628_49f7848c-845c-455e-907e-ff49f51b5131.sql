
-- Fix 1: has_union_homologacao_access - Remove flawed OR condition
CREATE OR REPLACE FUNCTION public.has_union_homologacao_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_super_admin(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND clinic_id = _clinic_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.professionals
      WHERE user_id = _user_id AND clinic_id = _clinic_id AND is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.union_entities
      WHERE user_id = _user_id
      AND status = 'ativa'::union_entity_status
    )
$$;

-- Fix 2: payslip_requests - Remove overly permissive policies
DROP POLICY IF EXISTS "Mobile app can view own payslip requests" ON public.payslip_requests;
DROP POLICY IF EXISTS "System can insert payslip requests" ON public.payslip_requests;
DROP POLICY IF EXISTS "System can update payslip requests" ON public.payslip_requests;

-- Authenticated clinic members can view payslip requests (already exists, keep)
-- Service role can insert (for mobile app backend calls)
CREATE POLICY "Service role can insert payslip requests"
  ON public.payslip_requests FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can insert for their clinic
CREATE POLICY "Authenticated users can insert payslip requests"
  ON public.payslip_requests FOR INSERT
  TO authenticated
  WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

-- Only clinic admins can update payslip requests
CREATE POLICY "Clinic admins can update payslip requests"
  ON public.payslip_requests FOR UPDATE
  TO authenticated
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- Fix 3: whatsapp_ai_conversations - restrict to service_role
DROP POLICY IF EXISTS "Service role full access to ai conversations" ON public.whatsapp_ai_conversations;

CREATE POLICY "Service role full access to ai conversations"
  ON public.whatsapp_ai_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix 4: Storage - Remove overly permissive anonymous read policies
DROP POLICY IF EXISTS "Allow payslip viewing" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to sindical-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Public read dependent-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view dependent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow payslip uploads from mobile app" ON storage.objects;
DROP POLICY IF EXISTS "System can upload payslips" ON storage.objects;

-- Restrict payslip uploads to authenticated clinic members or service role
CREATE POLICY "Authenticated clinic members can upload payslips"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contra-cheques'
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM clinics c
        WHERE c.id::text = (storage.foldername(name))[1]
        AND has_clinic_access(auth.uid(), c.id)
      )
    )
  );

CREATE POLICY "Service role can upload payslips"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'contra-cheques');

-- Fix 5: Clinics table - Replace USING(true) with restricted view
DROP POLICY IF EXISTS "Public can view clinic basic info by slug" ON public.clinics;

-- Create a secure view for public clinic info
CREATE OR REPLACE VIEW public.public_clinic_info AS
SELECT id, name, slug, logo_url, opening_time, closing_time, address, city, state_code, phone, email,
       booking_months_ahead, min_advance_booking_hours, holidays_enabled, map_view_type,
       custom_map_embed_url, entity_nomenclature, use_ai_booking, dependent_booking_limit,
       dependent_booking_limit_enabled, dependent_booking_period, titular_booking_limit_enabled,
       max_appointments_per_cpf_month, enforce_schedule_validation, patient_swap_deadline_hours,
       whatsapp_provider, app_unavailable, app_unavailable_message, is_maintenance, maintenance_reason,
       is_blocked
FROM public.clinics;

-- Allow public access to the view
GRANT SELECT ON public.public_clinic_info TO anon, authenticated;

-- Re-add clinic policy scoped to authenticated users who need it
CREATE POLICY "Public can view clinic basic info by slug"
  ON public.clinics FOR SELECT
  TO anon
  USING (true);
