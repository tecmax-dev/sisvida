-- Add new fields to professionals table for address, location, and profile information
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS education TEXT,
ADD COLUMN IF NOT EXISTS experience TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index for professional slugs within a clinic
CREATE UNIQUE INDEX IF NOT EXISTS idx_professionals_clinic_slug 
ON public.professionals(clinic_id, slug) 
WHERE slug IS NOT NULL;