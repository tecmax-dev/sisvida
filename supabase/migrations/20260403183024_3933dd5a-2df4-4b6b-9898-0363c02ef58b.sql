-- Allow authenticated users to read whazing_tickets
CREATE POLICY "Authenticated users can read whazing tickets"
ON public.whazing_tickets
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update whazing_tickets (for closing, etc.)
CREATE POLICY "Authenticated users can update whazing tickets"
ON public.whazing_tickets
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);