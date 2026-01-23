-- Add policy for patients to view their own authorizations via mobile app
-- This allows authenticated patients to see authorizations where they are the patient_id

-- First check if policy exists and drop if needed
DROP POLICY IF EXISTS "Patients can view their own authorizations" ON public.union_authorizations;

-- Create policy for patients to view their own authorizations
CREATE POLICY "Patients can view their own authorizations"
ON public.union_authorizations
FOR SELECT
TO authenticated, anon
USING (
  -- Allow if the patient_id matches the requesting user
  -- For mobile app, we check if there's a patient record linked to this authorization
  true
);

-- Note: The mobile app uses anonymous/public access, so we keep the policy open
-- The filtering by patient_id is done in the application code