-- Fix has_clinic_access to include super admin check
CREATE OR REPLACE FUNCTION public.has_clinic_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Super admin has access to all clinics
    EXISTS (
      SELECT 1 FROM public.super_admins WHERE user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.professionals
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND is_active = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.union_entities
      WHERE user_id = _user_id
        AND clinic_id = _clinic_id
        AND status = 'ativa'
    );
$$;