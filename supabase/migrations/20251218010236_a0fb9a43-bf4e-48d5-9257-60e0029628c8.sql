-- Drop the restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Users can create clinics" ON public.clinics;

CREATE POLICY "Users can create clinics" 
ON public.clinics 
FOR INSERT 
TO authenticated
WITH CHECK (true);
