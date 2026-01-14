-- Add configuration for allowing duplicate competence contributions
ALTER TABLE public.union_entities 
ADD COLUMN allow_duplicate_competence BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.union_entities.allow_duplicate_competence IS 'Permite emissão de múltiplos boletos para a mesma competência';