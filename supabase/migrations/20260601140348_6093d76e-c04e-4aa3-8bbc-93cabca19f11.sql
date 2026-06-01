DROP POLICY IF EXISTS "queue_calls_public_insert" ON public.queue_calls;

CREATE POLICY "queue_calls_clinic_insert"
ON public.queue_calls
FOR INSERT
TO authenticated
WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));
