
-- 1) Patient-photos: make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'patient-photos';

-- Drop the public SELECT policy and replace with authenticated-only
DROP POLICY IF EXISTS "Public can view patient photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view patient photos" ON storage.objects;

CREATE POLICY "Authenticated can view patient photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patient-photos');

-- 2) Whazing tables: restrict to service_role only (frontend uses edge functions)
DROP POLICY IF EXISTS "Authenticated users can manage quick responses" ON public.whazing_quick_responses;
CREATE POLICY "Service role manages quick responses"
  ON public.whazing_quick_responses FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage tags" ON public.whazing_tags;
CREATE POLICY "Service role manages tags"
  ON public.whazing_tags FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage ticket tags" ON public.whazing_ticket_tags;
CREATE POLICY "Service role manages ticket tags"
  ON public.whazing_ticket_tags FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage queues" ON public.whazing_queues;
CREATE POLICY "Service role manages queues"
  ON public.whazing_queues FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Appointments: replace anon SELECT with a restricted RPC-based approach
-- Drop the overly permissive anon SELECT policy
DROP POLICY IF EXISTS "Public can view appointment times for scheduling" ON public.appointments;

-- Create a function that returns only availability slots (no patient IDs)
CREATE OR REPLACE FUNCTION public.get_appointment_slots(
  p_clinic_id UUID,
  p_professional_id UUID,
  p_date DATE
)
RETURNS TABLE (
  appointment_date DATE,
  start_time TIME,
  end_time TIME,
  professional_id UUID,
  clinic_id UUID
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    a.appointment_date::DATE,
    a.start_time::TIME,
    a.end_time::TIME,
    a.professional_id,
    a.clinic_id
  FROM public.appointments a
  WHERE a.clinic_id = p_clinic_id
    AND a.professional_id = p_professional_id
    AND a.appointment_date = p_date
    AND a.status IN ('scheduled', 'confirmed');
$$;

-- Grant anon access to the function
GRANT EXECUTE ON FUNCTION public.get_appointment_slots(UUID, UUID, DATE) TO anon, authenticated;

-- 4) Fix security definer view on public_clinic_info
ALTER VIEW public.public_clinic_info SET (security_invoker = on);
