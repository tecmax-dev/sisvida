CREATE OR REPLACE FUNCTION public.get_app_availability(_clinic_id uuid)
 RETURNS TABLE(name text, phone text, is_unavailable boolean, message text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH f AS (
    SELECT (_clinic_id = '89e7585e-7bce-4e58-91fa-c37080d1170d'::uuid) OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.plan_features pf ON pf.plan_id = s.plan_id
      JOIN public.system_features sf ON sf.id = pf.feature_id AND sf.key = 'mobile_app' AND sf.is_active
      WHERE s.clinic_id = _clinic_id AND s.status IN ('active','trial','trialing')
    ) AS has_app
  )
  SELECT c.name::text, c.phone::text,
    COALESCE(c.app_unavailable,false) OR COALESCE(c.is_maintenance,false) OR NOT f.has_app,
    COALESCE(c.app_unavailable_message,
      CASE WHEN c.is_maintenance THEN c.maintenance_reason
           WHEN NOT f.has_app THEN 'O aplicativo não está disponível para esta entidade. Entre em contato com a administração.' END)::text
  FROM public.clinics c, f WHERE c.id = _clinic_id
$function$;