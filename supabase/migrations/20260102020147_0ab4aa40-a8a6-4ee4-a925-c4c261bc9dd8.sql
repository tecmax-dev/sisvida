-- Add phone column to patient_dependents table
ALTER TABLE public.patient_dependents
ADD COLUMN IF NOT EXISTS phone TEXT;