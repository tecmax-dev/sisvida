CREATE OR REPLACE FUNCTION public.get_my_mobile_appointments()
RETURNS TABLE (
  id uuid,
  appointment_date date,
  start_time time without time zone,
  end_time time without time zone,
  status public.appointment_status,
  type public.appointment_type,
  notes text,
  dependent_id uuid,
  professional jsonb,
  procedure jsonb,
  dependent jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH current_patient AS (
    SELECT nullif(
      coalesce(
        auth.jwt() -> 'app_metadata' ->> 'patient_id',
        auth.jwt() -> 'user_metadata' ->> 'patient_id',
        CASE
          WHEN lower(coalesce(auth.jwt() ->> 'email', '')) ~ '^patient\.[0-9a-f-]{36}@patients\.app\.internal$'
          THEN split_part(split_part(lower(auth.jwt() ->> 'email'), '@', 1), '.', 2)
          ELSE NULL
        END
      ),
      ''
    )::uuid AS id
  )
  SELECT
    a.id,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.status,
    a.type,
    a.notes,
    a.dependent_id,
    jsonb_build_object(
      'id', pr.id,
      'name', coalesce(pr.name, 'Profissional não informado'),
      'specialty', pr.specialty
    ) AS professional,
    CASE WHEN pc.id IS NULL THEN NULL ELSE jsonb_build_object('id', pc.id, 'name', pc.name) END AS procedure,
    CASE WHEN pd.id IS NULL THEN NULL ELSE jsonb_build_object('id', pd.id, 'name', pd.name) END AS dependent
  FROM public.appointments a
  JOIN current_patient cp ON cp.id = a.patient_id
  LEFT JOIN public.professionals pr ON pr.id = a.professional_id
  LEFT JOIN public.procedures pc ON pc.id = a.procedure_id
  LEFT JOIN public.patient_dependents pd ON pd.id = a.dependent_id AND pd.patient_id = cp.id
  ORDER BY a.appointment_date DESC, a.start_time DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_mobile_appointments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_mobile_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_mobile_appointments() TO service_role;