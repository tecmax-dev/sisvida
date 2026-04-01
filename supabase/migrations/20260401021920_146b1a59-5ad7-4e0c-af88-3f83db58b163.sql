-- =====================================================
-- BATCH 1: Fix critical RLS policies
-- =====================================================

-- 1. PATIENTS: Drop overly permissive public SELECT
DROP POLICY IF EXISTS "Public can view patient name via card token" ON public.patients;

-- 2. PATIENT_CARDS: Drop overly permissive anon policies
DROP POLICY IF EXISTS "Anon can read patient cards for mobile app" ON public.patient_cards;
DROP POLICY IF EXISTS "Public can view cards by QR token" ON public.patient_cards;

-- 3. APPOINTMENTS: Drop overly permissive anon SELECT
DROP POLICY IF EXISTS "Anon can view all appointments for patient lookup" ON public.appointments;
DROP POLICY IF EXISTS "Public can view appointments by confirmation token" ON public.appointments;

-- 4. PENDING_CONFIRMATIONS: Drop fully open policy
DROP POLICY IF EXISTS "System can manage pending confirmations" ON public.pending_confirmations;

CREATE POLICY "Service role can manage pending confirmations"
  ON public.pending_confirmations
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. PUSH_NOTIFICATION_TOKENS: Drop fully open policy
DROP POLICY IF EXISTS "Patients can manage their own tokens" ON public.push_notification_tokens;

CREATE POLICY "Service role can manage push tokens"
  ON public.push_notification_tokens
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated can read push tokens from their clinic"
  ON public.push_notification_tokens
  FOR SELECT
  TO authenticated
  USING (has_clinic_access(auth.uid(), clinic_id));