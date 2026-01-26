-- =====================================================
-- RLS POLICIES PARA APP MOBILE (anon role)
-- Autorizado em: 2026-01-26
-- Objetivo: Permitir SELECT controlado para fluxo de agendamento
-- =====================================================

-- 1️⃣ PATIENTS - Permitir leitura para app mobile
CREATE POLICY "Anon can read patients for mobile app"
ON public.patients
FOR SELECT
TO anon
USING (true);

-- 2️⃣ PATIENT_CARDS - Permitir leitura para app mobile
CREATE POLICY "Anon can read patient cards for mobile app"
ON public.patient_cards
FOR SELECT
TO anon
USING (true);

-- 3️⃣ PROFESSIONALS - Permitir leitura de profissionais ativos
CREATE POLICY "Anon can read active professionals by clinic"
ON public.professionals
FOR SELECT
TO anon
USING (is_active = true);