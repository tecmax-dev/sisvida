-- Add employer_name column to patients table to store company name from CNPJ lookup
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS employer_name TEXT;