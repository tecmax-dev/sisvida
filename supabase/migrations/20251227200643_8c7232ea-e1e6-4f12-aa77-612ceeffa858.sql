-- Fix RLS policies for all medical repass tables

-- 1. medical_repass_rules
DROP POLICY IF EXISTS "medical_repass_rules_admin" ON public.medical_repass_rules;
DROP POLICY IF EXISTS "medical_repass_rules_select" ON public.medical_repass_rules;

CREATE POLICY "medical_repass_rules_select" ON public.medical_repass_rules
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id) AND (deleted_at IS NULL OR is_super_admin(auth.uid())));

CREATE POLICY "medical_repass_rules_insert" ON public.medical_repass_rules
  FOR INSERT WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_rules_update" ON public.medical_repass_rules
  FOR UPDATE USING (is_clinic_admin(auth.uid(), clinic_id)) WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_rules_delete" ON public.medical_repass_rules
  FOR DELETE USING (is_clinic_admin(auth.uid(), clinic_id));

-- 2. medical_repass_periods
DROP POLICY IF EXISTS "medical_repass_periods_admin" ON public.medical_repass_periods;
DROP POLICY IF EXISTS "medical_repass_periods_select" ON public.medical_repass_periods;

CREATE POLICY "medical_repass_periods_select" ON public.medical_repass_periods
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id) AND (deleted_at IS NULL OR is_super_admin(auth.uid())));

CREATE POLICY "medical_repass_periods_insert" ON public.medical_repass_periods
  FOR INSERT WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_periods_update" ON public.medical_repass_periods
  FOR UPDATE USING (is_clinic_admin(auth.uid(), clinic_id)) WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_periods_delete" ON public.medical_repass_periods
  FOR DELETE USING (is_clinic_admin(auth.uid(), clinic_id));

-- 3. medical_repass_items
DROP POLICY IF EXISTS "medical_repass_items_admin" ON public.medical_repass_items;
DROP POLICY IF EXISTS "medical_repass_items_select" ON public.medical_repass_items;

CREATE POLICY "medical_repass_items_select" ON public.medical_repass_items
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_items_insert" ON public.medical_repass_items
  FOR INSERT WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_items_update" ON public.medical_repass_items
  FOR UPDATE USING (is_clinic_admin(auth.uid(), clinic_id)) WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_items_delete" ON public.medical_repass_items
  FOR DELETE USING (is_clinic_admin(auth.uid(), clinic_id));

-- 4. medical_repass_payments
DROP POLICY IF EXISTS "medical_repass_payments_admin" ON public.medical_repass_payments;
DROP POLICY IF EXISTS "medical_repass_payments_select" ON public.medical_repass_payments;

CREATE POLICY "medical_repass_payments_select" ON public.medical_repass_payments
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_payments_insert" ON public.medical_repass_payments
  FOR INSERT WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_payments_update" ON public.medical_repass_payments
  FOR UPDATE USING (is_clinic_admin(auth.uid(), clinic_id)) WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "medical_repass_payments_delete" ON public.medical_repass_payments
  FOR DELETE USING (is_clinic_admin(auth.uid(), clinic_id));