
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_duplicate_slot
ON public.appointments (professional_id, appointment_date, start_time)
WHERE status NOT IN ('cancelled', 'completed', 'no_show', 'blocked');
