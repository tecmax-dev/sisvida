-- Add is_active column to patients table
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create index for better performance when filtering active patients
CREATE INDEX IF NOT EXISTS idx_patients_is_active ON public.patients(is_active) WHERE is_active = true;