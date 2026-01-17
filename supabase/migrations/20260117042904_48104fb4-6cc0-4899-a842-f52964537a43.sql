-- Add missing columns to sindical_associados table for the new affiliation form
ALTER TABLE public.sindical_associados 
ADD COLUMN IF NOT EXISTS nome_pai TEXT,
ADD COLUMN IF NOT EXISTS nome_mae TEXT,
ADD COLUMN IF NOT EXISTS documento_rg_verso_url TEXT;