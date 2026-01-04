-- Add per-patient appointment limit override
-- NULL means use clinic default, otherwise use this value
ALTER TABLE public.patients 
ADD COLUMN max_appointments_per_month integer DEFAULT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.patients.max_appointments_per_month IS 'Override for max appointments per CPF per month. NULL uses clinic default.';