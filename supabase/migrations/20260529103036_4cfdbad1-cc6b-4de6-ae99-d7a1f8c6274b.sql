
DROP POLICY IF EXISTS "Public can create patients" ON public.patients;

REVOKE SELECT ON public.homologacao_professionals FROM anon;
GRANT SELECT (
  id, clinic_id, name, function, avatar_url, slug, city, state_code,
  is_active, public_booking_enabled, created_at, updated_at,
  description, address, latitude, longitude
) ON public.homologacao_professionals TO anon;

DROP POLICY IF EXISTS "Restrict realtime subscriptions by clinic" ON realtime.messages;
CREATE POLICY "Restrict realtime subscriptions by clinic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  ((auth.jwt() ->> 'role') = 'super_admin')
  OR (
    COALESCE(auth.jwt() ->> 'clinic_id', '') <> ''
    AND realtime.topic() LIKE '%' || (auth.jwt() ->> 'clinic_id') || '%'
  )
  OR (
    COALESCE(auth.jwt() ->> 'patient_id', '') <> ''
    AND realtime.topic() LIKE '%' || (auth.jwt() ->> 'patient_id') || '%'
  )
);
