CREATE TABLE IF NOT EXISTS public.chatgoo_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  event text NOT NULL,
  phone text,
  patient_id uuid,
  clinic_id uuid,
  intent text,
  decision text,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatgoo_events_created_at ON public.chatgoo_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatgoo_events_phone ON public.chatgoo_events (phone);

GRANT SELECT ON public.chatgoo_events TO authenticated;
GRANT ALL ON public.chatgoo_events TO service_role;

ALTER TABLE public.chatgoo_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chatgoo_events_admin_read" ON public.chatgoo_events;
CREATE POLICY "chatgoo_events_admin_read"
ON public.chatgoo_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','owner')
  )
  OR EXISTS (
    SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()
  )
);