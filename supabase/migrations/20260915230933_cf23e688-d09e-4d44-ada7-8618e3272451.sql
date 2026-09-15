CREATE POLICY "Service role manages WhatsApp dedup"
ON public.whatsapp_webhook_dedup
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);