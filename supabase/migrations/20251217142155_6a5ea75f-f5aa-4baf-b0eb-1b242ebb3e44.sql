-- Create super_admins table for global administrators
CREATE TABLE public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = _user_id
  )
$$;

-- RLS: Only super admins can view the super_admins table
CREATE POLICY "Super admins can view all super admins"
ON public.super_admins
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- RLS: Only super admins can insert new super admins
CREATE POLICY "Super admins can insert super admins"
ON public.super_admins
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- RLS: Only super admins can delete super admins
CREATE POLICY "Super admins can delete super admins"
ON public.super_admins
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Update clinics RLS to allow super admins to view all
CREATE POLICY "Super admins can view all clinics"
ON public.clinics
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Update patients RLS to allow super admins to view all
CREATE POLICY "Super admins can view all patients"
ON public.patients
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Update appointments RLS to allow super admins to view all
CREATE POLICY "Super admins can view all appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Update professionals RLS to allow super admins to view all
CREATE POLICY "Super admins can view all professionals"
ON public.professionals
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Update user_roles RLS to allow super admins to view all
CREATE POLICY "Super admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));