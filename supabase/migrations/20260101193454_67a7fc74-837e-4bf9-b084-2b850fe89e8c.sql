-- Add employer_cnpj column to patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS employer_cnpj text;

-- Add comment for documentation
COMMENT ON COLUMN public.patients.employer_cnpj IS 'CNPJ of the company where the patient works';