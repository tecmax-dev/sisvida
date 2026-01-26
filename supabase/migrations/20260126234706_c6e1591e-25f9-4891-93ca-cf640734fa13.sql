-- Add booking_months_ahead to clinics table
-- Default 1 means only current month, 2 means current + next month, etc.
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS booking_months_ahead integer DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN public.clinics.booking_months_ahead IS 'Number of months ahead that patients can book appointments. 1 = current month only, 2 = current + next month, etc.';