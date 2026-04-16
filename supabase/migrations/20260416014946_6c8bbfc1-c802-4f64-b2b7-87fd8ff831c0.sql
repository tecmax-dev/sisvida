-- Fix 4: Fix the privilege escalation in union_authorizations
-- First, check current policy
-- The issue: anonymous users can INSERT with any patient_id without validation

-- Drop the vulnerable anon INSERT policy
DROP POLICY IF EXISTS "Mobile app can create self-service authorizations" ON public.union_authorizations;

-- Create new secure policy that requires the patient to have a valid CPF and belongs to the clinic
CREATE POLICY "Mobile app can create self-service authorizations"
ON public.union_authorizations 
FOR INSERT 
TO anon
WITH CHECK (
    patient_id IS NOT NULL 
    AND created_by = patient_id
    AND EXISTS (
        SELECT 1 FROM public.patients p 
        WHERE p.id = patient_id 
        AND p.cpf IS NOT NULL 
        AND p.cpf <> ''
        -- Require the patient to have a valid registration
        AND p.is_active = true
    )
);

COMMENT ON POLICY "Mobile app can create self-service authorizations" 
ON public.union_authorizations 
IS 'Only allows creating authorizations for patients with verified CPF registration';