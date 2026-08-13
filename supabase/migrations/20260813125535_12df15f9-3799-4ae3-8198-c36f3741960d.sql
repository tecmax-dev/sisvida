GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON public.payslip_requests TO authenticated;
GRANT ALL ON public.payslip_requests TO service_role;
GRANT ALL ON public.patient_payslip_history TO authenticated;
GRANT ALL ON public.patient_payslip_history TO service_role;

ALTER TABLE public.payslip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_payslip_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public payslip requests access" ON public.payslip_requests;
DROP POLICY IF EXISTS "Authenticated users can see their clinic's payslip requests" ON public.payslip_requests;
DROP POLICY IF EXISTS "Service role has full access to payslip_requests" ON public.payslip_requests;

CREATE POLICY "Authenticated users can see their clinic's payslip requests"
ON public.payslip_requests
FOR ALL
TO authenticated
USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Service role has full access to payslip_requests"
ON public.payslip_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can see their clinic's payslip history" ON public.patient_payslip_history;
DROP POLICY IF EXISTS "Service role has full access to patient_payslip_history" ON public.patient_payslip_history;

CREATE POLICY "Authenticated users can see their clinic's payslip history"
ON public.patient_payslip_history
FOR ALL
TO authenticated
USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Service role has full access to patient_payslip_history"
ON public.patient_payslip_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);