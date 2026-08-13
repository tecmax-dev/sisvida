CREATE TABLE IF NOT EXISTS public.whatsapp_message_status (
  id uuid primary key default gen_random_uuid(),
  wamid text,
  recipient_id text,
  status text,
  error_code text,
  error_title text,
  error_details text,
  timestamp_meta timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.whatsapp_message_status TO authenticated;
GRANT ALL ON public.whatsapp_message_status TO service_role;
ALTER TABLE public.whatsapp_message_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view whatsapp status" ON public.whatsapp_message_status
FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_wa_status_wamid ON public.whatsapp_message_status(wamid);