
-- Drop the incorrect RLS policy
DROP POLICY IF EXISTS "Members can view their own authorizations" ON public.union_authorizations;

-- Create a new policy that allows anon to read all authorizations
-- The filtering by patient_id will be done at the application level
-- since the mobile app uses localStorage for authentication, not Supabase Auth
CREATE POLICY "Mobile app can read authorizations"
ON public.union_authorizations
FOR SELECT
TO anon
USING (true);
