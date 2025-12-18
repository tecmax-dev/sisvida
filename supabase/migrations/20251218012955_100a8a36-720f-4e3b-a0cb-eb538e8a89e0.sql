-- Fix: Convert the "Public can view clinic basic info by slug" policy to PERMISSIVE
-- This is required because RESTRICTIVE policies ALL need to pass, but new users have no roles
DROP POLICY IF EXISTS "Public can view clinic basic info by slug" ON public.clinics;

CREATE POLICY "Public can view clinic basic info by slug" 
ON public.clinics 
FOR SELECT 
TO public
USING (true);