CREATE OR REPLACE FUNCTION public.get_app_availability(_clinic_id uuid)
RETURNS TABLE(name text, phone text, is_unavailable boolean, message text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.name::text, c.phone::text,
    COALESCE(c.app_unavailable,false) OR COALESCE(c.is_maintenance,false),
    COALESCE(c.app_unavailable_message, CASE WHEN c.is_maintenance THEN c.maintenance_reason END)::text
  FROM public.clinics c WHERE c.id = _clinic_id
$$;
GRANT EXECUTE ON FUNCTION public.get_app_availability(uuid) TO anon, authenticated;