-- Create unique index on appointment_id for medical_records to allow upsert
CREATE UNIQUE INDEX IF NOT EXISTS medical_records_unique_appointment_id 
ON public.medical_records (appointment_id) 
WHERE appointment_id IS NOT NULL;