
-- Add max_patient_age column to professionals table
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS max_patient_age integer DEFAULT NULL;

-- Set max_patient_age = 14 for Uiara Tiuba (active one)
UPDATE public.professionals 
SET max_patient_age = 14 
WHERE id = '4012d4ac-ec6f-455e-b0bd-cd7d565c7abe';

COMMENT ON COLUMN public.professionals.max_patient_age IS 'Maximum allowed patient age for booking with this professional. NULL means no restriction.';
