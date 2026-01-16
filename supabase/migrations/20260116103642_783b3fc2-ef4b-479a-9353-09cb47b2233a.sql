-- Allow public access to homologacao schedules for active booking-enabled professionals
CREATE POLICY "Public can view schedules for booking-enabled professionals"
ON public.homologacao_schedules
FOR SELECT
TO anon, authenticated
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM public.homologacao_professionals p 
    WHERE p.id = professional_id 
    AND p.is_active = true 
    AND p.public_booking_enabled = true
  )
);

-- Allow public access to homologacao blocks for booking validation
CREATE POLICY "Public can view blocks for booking validation"
ON public.homologacao_blocks
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.homologacao_professionals p 
    WHERE (professional_id IS NULL OR p.id = professional_id)
    AND p.is_active = true 
    AND p.public_booking_enabled = true
    AND p.clinic_id = homologacao_blocks.clinic_id
  )
);

-- Allow public access to active service types for booking
CREATE POLICY "Public can view active service types"
ON public.homologacao_service_types
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Allow public access to view scheduled appointments for availability check
CREATE POLICY "Public can view appointments for availability"
ON public.homologacao_appointments
FOR SELECT
TO anon, authenticated
USING (status != 'cancelled');