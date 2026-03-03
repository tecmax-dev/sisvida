-- Add configurable minimum advance booking hours to clinics table
ALTER TABLE public.clinics 
ADD COLUMN min_advance_booking_hours integer DEFAULT 6;

COMMENT ON COLUMN public.clinics.min_advance_booking_hours IS 'Minimum hours in advance required to book via slots. Default 6 hours.';