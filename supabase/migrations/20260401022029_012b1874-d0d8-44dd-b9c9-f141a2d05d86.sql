-- =====================================================
-- BATCH 3: Fix remaining RLS policies (retry)
-- =====================================================

-- 12. HOMOLOGACAO_APPOINTMENTS: Create restricted view for public availability
CREATE OR REPLACE VIEW public.homologacao_availability AS
SELECT 
  id,
  clinic_id,
  professional_id,
  service_type_id,
  appointment_date,
  start_time,
  end_time,
  status
FROM public.homologacao_appointments
WHERE status <> 'cancelled';

GRANT SELECT ON public.homologacao_availability TO anon, authenticated;

-- 13. UNION_AUTHORIZATIONS: Fix multiple USING(true) policies
DROP POLICY IF EXISTS "Mobile app can read authorizations" ON public.union_authorizations;
DROP POLICY IF EXISTS "Patients can view their own authorizations" ON public.union_authorizations;
DROP POLICY IF EXISTS "Public can validate authorizations by hash" ON public.union_authorizations;

CREATE OR REPLACE FUNCTION public.validate_authorization_by_hash(p_hash text)
RETURNS TABLE(
  authorization_number text,
  status text,
  valid_from date,
  valid_until date,
  benefit_name text,
  is_valid boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ua.authorization_number,
    ua.status,
    ua.valid_from,
    ua.valid_until,
    ub.name as benefit_name,
    (ua.status = 'active' AND ua.valid_until >= CURRENT_DATE) as is_valid
  FROM public.union_authorizations ua
  LEFT JOIN public.union_benefits ub ON ub.id = ua.benefit_id
  WHERE ua.validation_hash = p_hash
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_authorizations(p_patient_id uuid)
RETURNS SETOF public.union_authorizations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.union_authorizations
  WHERE patient_id = p_patient_id
  ORDER BY created_at DESC;
$$;

-- 14. BANK STATEMENT TABLES: Add clinic-scoped access
DROP POLICY IF EXISTS "Authenticated users can manage bank statement imports" ON public.union_bank_statement_imports;
DROP POLICY IF EXISTS "Authenticated users can manage bank statement transactions" ON public.union_bank_statement_transactions;

CREATE POLICY "Clinic staff can manage bank statement imports"
  ON public.union_bank_statement_imports
  FOR ALL
  TO authenticated
  USING (has_clinic_access(auth.uid(), clinic_id) OR is_super_admin(auth.uid()))
  WITH CHECK (has_clinic_access(auth.uid(), clinic_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Clinic staff can manage bank statement transactions"
  ON public.union_bank_statement_transactions
  FOR ALL
  TO authenticated
  USING (has_clinic_access(auth.uid(), clinic_id) OR is_super_admin(auth.uid()))
  WITH CHECK (has_clinic_access(auth.uid(), clinic_id) OR is_super_admin(auth.uid()));

-- 15. LYTEX_SYNC_LOGS: Fix fully open policy
DROP POLICY IF EXISTS "Service role can manage sync logs" ON public.lytex_sync_logs;

CREATE POLICY "Service role can manage sync logs"
  ON public.lytex_sync_logs
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 16. WHATSAPP_BOLETO_LOGS: Fix fully open policy
DROP POLICY IF EXISTS "Service role can manage boleto logs" ON public.whatsapp_boleto_logs;

CREATE POLICY "Service role can manage boleto logs"
  ON public.whatsapp_boleto_logs
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');