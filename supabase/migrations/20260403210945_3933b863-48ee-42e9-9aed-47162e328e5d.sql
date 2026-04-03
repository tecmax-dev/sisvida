CREATE POLICY "Authenticated users can insert whazing tickets"
ON public.whazing_tickets
FOR INSERT
TO authenticated
WITH CHECK (true);