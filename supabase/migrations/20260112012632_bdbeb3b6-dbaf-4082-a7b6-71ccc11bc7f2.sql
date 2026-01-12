-- Add clinic_id to union_entities to link entities with their clinic data
ALTER TABLE public.union_entities
ADD COLUMN clinic_id UUID REFERENCES public.clinics(id);

-- Create index for faster lookups
CREATE INDEX idx_union_entities_clinic_id ON public.union_entities(clinic_id);

-- Update the existing entity to link with the Sindicato clinic
UPDATE public.union_entities
SET clinic_id = '89e7585e-7bce-4e58-91fa-c37080d1170d'
WHERE id = '74f74e75-6b09-43d5-bf75-41225e085e28';

-- Comment explaining the relationship
COMMENT ON COLUMN public.union_entities.clinic_id IS 'Links union entity to its clinic for data access (employers, contributions, etc.)';