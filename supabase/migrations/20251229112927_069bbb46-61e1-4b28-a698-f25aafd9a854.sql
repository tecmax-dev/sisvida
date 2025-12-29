-- Ensure holiday tables are readable on public pages (anon users)
-- Holidays are not sensitive; they are required to block public scheduling.

-- Enable RLS (safe if already enabled)
ALTER TABLE IF EXISTS public.national_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.state_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.municipal_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clinic_holidays ENABLE ROW LEVEL SECURITY;

-- Recreate public SELECT policies
DROP POLICY IF EXISTS "Public can read national holidays" ON public.national_holidays;
CREATE POLICY "Public can read national holidays"
ON public.national_holidays
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public can read state holidays" ON public.state_holidays;
CREATE POLICY "Public can read state holidays"
ON public.state_holidays
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public can read municipal holidays" ON public.municipal_holidays;
CREATE POLICY "Public can read municipal holidays"
ON public.municipal_holidays
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public can read clinic holidays" ON public.clinic_holidays;
CREATE POLICY "Public can read clinic holidays"
ON public.clinic_holidays
FOR SELECT
USING (true);

-- Hard-block scheduling on holidays at DB level (server-side protection)
-- Requires validate_appointment_holiday() already exists.
DROP TRIGGER IF EXISTS validate_holiday_before_appointment ON public.appointments;
CREATE TRIGGER validate_holiday_before_appointment
BEFORE INSERT OR UPDATE OF appointment_date ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.validate_appointment_holiday();
