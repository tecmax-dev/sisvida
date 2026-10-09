CREATE OR REPLACE FUNCTION public.can_bypass_dependent_booking_limit(_user_id uuid, _clinic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_clinic_admin(_user_id, _clinic_id) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.access_groups g ON g.id = ur.access_group_id
    WHERE ur.user_id = _user_id AND ur.clinic_id = _clinic_id
      AND g.is_active AND g.name ILIKE 'Administrativo%'
  )
$$;

DO $do$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('public.validate_dependent_appointment_limit'::regproc);
  v_def := replace(v_def, 'user_is_admin := public.is_clinic_admin(current_user_id, NEW.clinic_id);',
                          'user_is_admin := public.can_bypass_dependent_booking_limit(current_user_id, NEW.clinic_id);');
  EXECUTE v_def;
END $do$;