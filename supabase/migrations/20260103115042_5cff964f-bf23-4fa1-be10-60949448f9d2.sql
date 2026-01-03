-- Add recurrence support to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS recurrence_group_id uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;

-- Create index for recurrence group lookups
CREATE INDEX IF NOT EXISTS idx_appointments_recurrence_group_id 
ON public.appointments(recurrence_group_id) 
WHERE recurrence_group_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.appointments.recurrence_group_id IS 'Groups recurring appointments together for bulk operations';
COMMENT ON COLUMN public.appointments.is_recurring IS 'Indicates if this appointment is part of a recurring series';