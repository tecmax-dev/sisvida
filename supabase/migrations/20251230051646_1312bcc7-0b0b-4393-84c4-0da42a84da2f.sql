-- Fix: ensure only one medical record per appointment to prevent duplicates and "maybeSingle" load failures

-- 1) Remove duplicates (keep the most recently updated/created)
WITH ranked AS (
  SELECT
    id,
    appointment_id,
    row_number() OVER (
      PARTITION BY appointment_id
      ORDER BY updated_at DESC, created_at DESC
    ) AS rn
  FROM public.medical_records
  WHERE appointment_id IS NOT NULL
)
DELETE FROM public.medical_records mr
USING ranked r
WHERE mr.id = r.id
  AND r.rn > 1;

-- 2) Enforce uniqueness for appointment-linked records
CREATE UNIQUE INDEX IF NOT EXISTS medical_records_unique_appointment_id
ON public.medical_records (appointment_id)
WHERE appointment_id IS NOT NULL;