-- Enable public access to clinics for reading (for public booking page)
CREATE POLICY "Public can view clinic basic info by slug"
ON public.clinics
FOR SELECT
TO anon
USING (true);

-- Enable public access to professionals for reading (for public booking page)
CREATE POLICY "Public can view active professionals"
ON public.professionals
FOR SELECT
TO anon
USING (is_active = true);

-- Enable public access to insurance plans for reading (for public booking page)
CREATE POLICY "Public can view active insurance plans"
ON public.insurance_plans
FOR SELECT
TO anon
USING (is_active = true);

-- Enable public access to appointments for reading time slots
CREATE POLICY "Public can view appointment times for scheduling"
ON public.appointments
FOR SELECT
TO anon
USING (status IN ('scheduled', 'confirmed'));

-- Enable public insert for patients (for public booking)
CREATE POLICY "Public can create patients"
ON public.patients
FOR INSERT
TO anon
WITH CHECK (true);

-- Enable public insert for appointments (for public booking)
CREATE POLICY "Public can create appointments"
ON public.appointments
FOR INSERT
TO anon
WITH CHECK (status = 'scheduled');