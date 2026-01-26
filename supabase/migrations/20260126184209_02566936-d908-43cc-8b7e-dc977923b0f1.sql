-- Permitir que usuários autenticados do app (pacientes) gerem declaração para si mesmos,
-- validando o patient_id/clinic_id a partir do JWT (user_metadata) sem casts perigosos.

DO $$
BEGIN
  -- Evitar duplicidade caso já exista com nome semelhante
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'union_authorizations'
      AND policyname = 'Patients (authenticated) can create self-service authorizations'
  ) THEN
    EXECUTE 'DROP POLICY "Patients (authenticated) can create self-service authorizations" ON public.union_authorizations';
  END IF;
END $$;

CREATE POLICY "Patients (authenticated) can create self-service authorizations"
ON public.union_authorizations
FOR INSERT
TO authenticated
WITH CHECK (
  patient_id IS NOT NULL
  AND created_by IS NOT NULL
  AND created_by = patient_id
  AND patient_id::text = COALESCE(auth.jwt() -> 'user_metadata' ->> 'patient_id', '')
  AND clinic_id::text  = COALESCE(auth.jwt() -> 'user_metadata' ->> 'clinic_id', '')
);
