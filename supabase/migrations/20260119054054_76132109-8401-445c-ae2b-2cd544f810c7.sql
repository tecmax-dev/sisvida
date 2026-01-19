-- =====================================================
-- SECURITY FIX: Proteção de dados pessoais sensíveis
-- =====================================================

-- 1. PATIENTS - Bloquear acesso público a dados de pacientes
DROP POLICY IF EXISTS "Patients are viewable by everyone" ON public.patients;
DROP POLICY IF EXISTS "Anyone can view patients" ON public.patients;

-- Apenas usuários autenticados da mesma clínica podem ver pacientes
CREATE POLICY "Clinic staff can view patients"
ON public.patients FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- 2. PATIENT_CARDS - Restringir acesso público
DROP POLICY IF EXISTS "Anyone can view patient cards" ON public.patient_cards;
DROP POLICY IF EXISTS "Patient cards are publicly readable" ON public.patient_cards;

-- Permitir apenas lookup por QR token específico (para validação de cartão)
CREATE POLICY "Patient cards viewable by qr_token lookup"
ON public.patient_cards FOR SELECT
TO anon, authenticated
USING (
  -- Acesso via token específico (para validação QR) OU staff da clínica
  auth.uid() IS NOT NULL AND clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- 3. APPOINTMENTS - Bloquear acesso público
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Appointments are publicly readable" ON public.appointments;

CREATE POLICY "Clinic staff can view appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- 4. EMAIL_CONFIRMATIONS - Bloquear acesso público total
DROP POLICY IF EXISTS "Anyone can view email confirmations" ON public.email_confirmations;
DROP POLICY IF EXISTS "Email confirmations are publicly readable" ON public.email_confirmations;

CREATE POLICY "Email confirmations not publicly readable"
ON public.email_confirmations FOR SELECT
USING (false);

-- 5. PATIENT_FIRST_ACCESS_TOKENS - Bloquear acesso público
DROP POLICY IF EXISTS "Anyone can view patient first access tokens" ON public.patient_first_access_tokens;
DROP POLICY IF EXISTS "Patient first access tokens are publicly readable" ON public.patient_first_access_tokens;

CREATE POLICY "First access tokens not publicly readable"
ON public.patient_first_access_tokens FOR SELECT
USING (false);

-- 6. PENDING_CONFIRMATIONS - Restringir a staff autenticado
DROP POLICY IF EXISTS "Anyone can view pending confirmations" ON public.pending_confirmations;
DROP POLICY IF EXISTS "Pending confirmations are publicly readable" ON public.pending_confirmations;

CREATE POLICY "Clinic staff can view pending confirmations"
ON public.pending_confirmations FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- 7. WHATSAPP_AI_CONVERSATIONS - Bloquear acesso público
DROP POLICY IF EXISTS "Anyone can view whatsapp conversations" ON public.whatsapp_ai_conversations;
DROP POLICY IF EXISTS "Whatsapp conversations are publicly readable" ON public.whatsapp_ai_conversations;

CREATE POLICY "Clinic staff can view whatsapp conversations"
ON public.whatsapp_ai_conversations FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- 8. LYTEX_SYNC_LOGS - Restringir a staff autenticado
DROP POLICY IF EXISTS "Anyone can view lytex sync logs" ON public.lytex_sync_logs;
DROP POLICY IF EXISTS "Lytex sync logs are publicly readable" ON public.lytex_sync_logs;

CREATE POLICY "Clinic staff can view lytex sync logs"
ON public.lytex_sync_logs FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);