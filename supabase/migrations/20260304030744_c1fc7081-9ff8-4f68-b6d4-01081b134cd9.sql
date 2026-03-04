SELECT cron.unschedule('send-negotiation-overdue-reminders-daily');

SELECT cron.schedule(
  'send-negotiation-overdue-reminders-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url:='https://czmnkrurkzuerrcjzbkp.supabase.co/functions/v1/send-negotiation-overdue-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bW5rcnVya3p1ZXJyY2p6YmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NDkyMzEsImV4cCI6MjA4NDIyNTIzMX0.fu3d_I0Y6cxOp0CJRee9R_QsxtckGFIFdMqys0Pey8I"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);