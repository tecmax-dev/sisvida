-- Fix patient_notifications RLS policies to read patient_id from JWT metadata
-- This enables realtime + direct SELECT for mobile patient sessions.

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.patient_notifications ENABLE ROW LEVEL SECURITY;

-- Drop old patient policies (if they exist)
DROP POLICY IF EXISTS "Patients can view own notifications" ON public.patient_notifications;
DROP POLICY IF EXISTS "Patients can mark as read" ON public.patient_notifications;

-- Recreate with robust claim extraction (supports user_metadata/app_metadata/custom claim)
CREATE POLICY "Patients can view own notifications"
ON public.patient_notifications
FOR SELECT
USING (
  patient_id = COALESCE(
    NULLIF(auth.jwt() ->> 'patient_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'patient_id', '')::uuid,
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'patient_id', '')::uuid
  )
);

CREATE POLICY "Patients can mark as read"
ON public.patient_notifications
FOR UPDATE
USING (
  patient_id = COALESCE(
    NULLIF(auth.jwt() ->> 'patient_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'patient_id', '')::uuid,
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'patient_id', '')::uuid
  )
)
WITH CHECK (
  patient_id = COALESCE(
    NULLIF(auth.jwt() ->> 'patient_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'patient_id', '')::uuid,
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'patient_id', '')::uuid
  )
);
