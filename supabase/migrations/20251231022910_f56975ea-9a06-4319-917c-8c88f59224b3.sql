-- Add council_type column to professionals table
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS council_type text;