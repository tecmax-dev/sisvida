-- Add 'administrative' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrative';

-- Create index on user_roles for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_clinic_user ON public.user_roles(clinic_id, user_id);

-- Update RLS policies to allow admins to manage user_roles
-- First drop the existing policy if it exists
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

-- Create policy for deleting user roles (admins only)
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (is_clinic_admin(auth.uid(), clinic_id));