-- Allow public/anonymous access to active homologacao professionals for booking
CREATE POLICY "Public can view active booking-enabled professionals"
ON public.homologacao_professionals
FOR SELECT
TO anon, authenticated
USING (
  is_active = true 
  AND public_booking_enabled = true
);