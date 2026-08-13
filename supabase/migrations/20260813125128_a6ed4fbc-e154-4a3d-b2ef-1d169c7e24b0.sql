GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslip_requests TO authenticated;
GRANT ALL ON public.payslip_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_payslip_history TO authenticated;
GRANT ALL ON public.patient_payslip_history TO service_role;

DO $$
BEGIN
    ALTER TABLE public.payslip_requests ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can select payslip_requests') THEN
        CREATE POLICY "Authenticated users can select payslip_requests" 
        ON public.payslip_requests FOR SELECT TO authenticated 
        USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role has full access to payslip_requests') THEN
        CREATE POLICY "Service role has full access to payslip_requests" 
        ON public.payslip_requests FOR ALL TO service_role 
        USING (true) WITH CHECK (true);
    END IF;

    ALTER TABLE public.patient_payslip_history ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can select history') THEN
        CREATE POLICY "Authenticated users can select history" 
        ON public.patient_payslip_history FOR SELECT TO authenticated 
        USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Service role has full access to history') THEN
        CREATE POLICY "Service role has full access to history" 
        ON public.patient_payslip_history FOR ALL TO service_role 
        USING (true) WITH CHECK (true);
    END IF;
END
$$;
