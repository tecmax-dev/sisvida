-- Create trigger to automatically generate slug for homologacao professionals
CREATE OR REPLACE TRIGGER trigger_generate_professional_slug
  BEFORE INSERT OR UPDATE ON public.homologacao_professionals
  FOR EACH ROW
  EXECUTE FUNCTION generate_professional_slug();

-- Fix existing corrupted slugs (regenerate from name)
UPDATE public.homologacao_professionals
SET slug = trim(both '-' from lower(regexp_replace(unaccent(name), '[^a-z0-9]+', '-', 'gi')));

-- Add UUID suffix for any duplicates
WITH duplicates AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
  FROM public.homologacao_professionals
)
UPDATE public.homologacao_professionals p
SET slug = p.slug || '-' || substring(p.id::text, 1, 8)
FROM duplicates d
WHERE p.id = d.id AND d.rn > 1;