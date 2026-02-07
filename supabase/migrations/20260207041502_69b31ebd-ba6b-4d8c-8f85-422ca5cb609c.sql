-- Add empresa_matricula column to sindical_associados
ALTER TABLE public.sindical_associados 
ADD COLUMN IF NOT EXISTS empresa_matricula TEXT;