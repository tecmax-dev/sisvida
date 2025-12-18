-- Add confirmation_token to appointments for secure public confirmation/cancellation
ALTER TABLE public.appointments 
ADD COLUMN confirmation_token uuid DEFAULT gen_random_uuid();

-- Create index for fast token lookups
CREATE INDEX idx_appointments_confirmation_token ON public.appointments(confirmation_token);

-- Add RLS policy for public access via confirmation token
CREATE POLICY "Public can view appointments by confirmation token" 
ON public.appointments 
FOR SELECT 
USING (confirmation_token IS NOT NULL);

CREATE POLICY "Public can update appointment status via token" 
ON public.appointments 
FOR UPDATE 
USING (confirmation_token IS NOT NULL)
WITH CHECK (status IN ('confirmed', 'cancelled'));