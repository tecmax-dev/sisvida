
-- Add RLS policy for clinic users to check if their clinic has a linked union entity
-- This allows the menu visibility check to work correctly

-- Policy for clinic users to SELECT union entities linked to their clinic
CREATE POLICY "Clinic users can view linked union entity"
ON public.union_entities
FOR SELECT
TO authenticated
USING (
  clinic_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.clinic_id = union_entities.clinic_id
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Clinic users can view linked union entity" ON public.union_entities IS 
'Allows authenticated users belonging to a clinic to check if their clinic has a linked union entity. Used for menu visibility control.';
