-- Add color column to insurance_plans table
ALTER TABLE public.insurance_plans 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#3B82F6';