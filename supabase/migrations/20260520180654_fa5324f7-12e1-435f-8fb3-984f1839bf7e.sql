-- #3 Remove tabelas não utilizadas da publicação Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.subscription_invoices;
ALTER PUBLICATION supabase_realtime DROP TABLE public.union_authorizations;
ALTER PUBLICATION supabase_realtime DROP TABLE public.whazing_quick_responses;
ALTER PUBLICATION supabase_realtime DROP TABLE public.whazing_ticket_tags;
ALTER PUBLICATION supabase_realtime DROP TABLE public.whazing_tickets;

-- #4 Retenção 90 dias para whatsapp_incoming_logs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.cleanup_whatsapp_incoming_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.whatsapp_incoming_logs
  WHERE created_at < now() - INTERVAL '90 days';
END;
$$;

-- Remove job anterior se existir
SELECT cron.unschedule('cleanup-whatsapp-incoming-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-whatsapp-incoming-logs');

SELECT cron.schedule(
  'cleanup-whatsapp-incoming-logs',
  '0 3 * * *',
  $$SELECT public.cleanup_whatsapp_incoming_logs();$$
);