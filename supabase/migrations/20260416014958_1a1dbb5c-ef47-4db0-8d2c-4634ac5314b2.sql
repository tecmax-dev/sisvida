-- Fix 3b: Properly secure clinics table by replacing the overly permissive public policy
-- First, let's see what policies exist and modify them

-- The issue: public can see ALL columns including owner_cpf, cnpj, etc
-- Solution: Create a policy that uses a secure function to check access

-- Create a security definer function to check if user should access sensitive clinic data
CREATE OR REPLACE FUNCTION public.can_access_clinic_full_info(check_clinic_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow access if user is authenticated and has proper membership
    IF auth.uid() IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.clinic_users 
            WHERE clinic_id = check_clinic_id 
            AND user_id = auth.uid()
            AND is_active = true
        );
    END IF;
    RETURN false;
END;
$$;

-- Create policy that restricts public access to only safe columns via the view
-- Drop existing public policy
DROP POLICY IF EXISTS "Public can view clinic basic info" ON public.clinics;

-- Create new restrictive public policy that essentially blocks direct table access
-- The view public_clinic_info should be used for public access instead
CREATE POLICY "Public can view clinic basic info" 
ON public.clinics 
FOR SELECT 
TO public
USING (false);  -- Block all direct access, force use of view

-- Grant access to the view instead
GRANT SELECT ON public.public_clinic_info TO anon, authenticated;

COMMENT ON FUNCTION public.can_access_clinic_full_info IS 'Security definer function to check if authenticated user can access full clinic sensitive data';
COMMENT ON POLICY "Public can view clinic basic info" ON public.clinics IS 'Blocks direct public access to clinics table - use public_clinic_info view instead';