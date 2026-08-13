
-- Corrigindo políticas de acesso para pacientes na waiting_list
-- Usando auth.jwt() para acessar metadados em vez de auth.users (que não é acessível via RLS em políticas complexas sem SECURITY DEFINER)

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'waiting_list' 
        AND policyname = 'Patients can view their own waiting list records'
    ) THEN
        CREATE POLICY "Patients can view their own waiting list records" 
        ON public.waiting_list 
        FOR SELECT 
        TO authenticated 
        USING (
            patient_id = (COALESCE(auth.jwt()->'app_metadata'->>'patient_id', auth.jwt()->'user_metadata'->>'patient_id'))::uuid
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'waiting_list' 
        AND policyname = 'Patients can update their own waiting list records'
    ) THEN
        CREATE POLICY "Patients can update their own waiting list records" 
        ON public.waiting_list 
        FOR UPDATE
        TO authenticated 
        USING (
            patient_id = (COALESCE(auth.jwt()->'app_metadata'->>'patient_id', auth.jwt()->'user_metadata'->>'patient_id'))::uuid
        )
        WITH CHECK (
            patient_id = (COALESCE(auth.jwt()->'app_metadata'->>'patient_id', auth.jwt()->'user_metadata'->>'patient_id'))::uuid
        );
    END IF;
END $$;

-- Garantir acesso ao Data API
GRANT SELECT, UPDATE ON public.waiting_list TO authenticated;
GRANT SELECT, UPDATE ON public.waiting_list TO service_role;
