-- Corrige a intermitência do WhatsApp/ChatGoo: a Meta pode revogar a
-- inscrição do app no número oficial (subscribed_apps) sem aviso. Antes,
-- a reinscrição só era tentada quando uma mensagem chegava — se a
-- inscrição já tivesse caído, nada mais chegava e o robô ficava mudo
-- indefinidamente (loop travado).
--
-- Este job chama periodicamente o próprio endpoint de status da Meta,
-- que já contém a lógica idempotente de reinscrição
-- (ensureMetaWebhookSubscription), independente de haver tráfego real.
select cron.schedule(
  'meta-webhook-resubscribe-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url:='https://czmnkrurkzuerrcjzbkp.supabase.co/functions/v1/meta-status-webhook',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bW5rcnVya3p1ZXJyY2p6YmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NDkyMzEsImV4cCI6MjA4NDIyNTIzMX0.fu3d_I0Y6cxOp0CJRee9R_QsxtckGFIFdMqys0Pey8I"}'::jsonb,
    body:='{"entry":[]}'::jsonb
  ) as request_id;
  $$
)
where not exists (
  select 1 from cron.job where jobname = 'meta-webhook-resubscribe-15min'
);
