-- Force recreate the INSERT policy for clinics to ensure it works
DROP POLICY IF EXISTS "Users can create clinics" ON public.clinics;

CREATE POLICY "Users can create clinics" 
ON public.clinics 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also ensure the user_roles INSERT policy is permissive for initial role assignment
DROP POLICY IF EXISTS "Users can insert their own initial role" ON public.user_roles;

CREATE POLICY "Users can insert their own initial role" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);