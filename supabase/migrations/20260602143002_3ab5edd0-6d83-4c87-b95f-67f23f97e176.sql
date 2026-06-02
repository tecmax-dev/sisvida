
CREATE TABLE public.email_inbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imap_uid BIGINT,
  message_id TEXT,
  in_reply_to TEXT,
  email_references TEXT,
  thread_key TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  cc_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  folder TEXT NOT NULL DEFAULT 'inbox',
  campaign_id UUID,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  size_bytes INT,
  raw_headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_inbox_messages_uid_uidx ON public.email_inbox_messages(imap_uid) WHERE imap_uid IS NOT NULL;
CREATE UNIQUE INDEX email_inbox_messages_msgid_uidx ON public.email_inbox_messages(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX email_inbox_messages_received_at_idx ON public.email_inbox_messages(received_at DESC);
CREATE INDEX email_inbox_messages_folder_idx ON public.email_inbox_messages(folder, received_at DESC);
CREATE INDEX email_inbox_messages_thread_idx ON public.email_inbox_messages(thread_key);
CREATE INDEX email_inbox_messages_from_idx ON public.email_inbox_messages(from_email);
CREATE INDEX email_inbox_messages_campaign_idx ON public.email_inbox_messages(campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_inbox_messages TO authenticated;
GRANT ALL ON public.email_inbox_messages TO service_role;

ALTER TABLE public.email_inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_email_inbox(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner'::app_role, 'admin'::app_role, 'entidade_sindical_admin'::app_role)
  ) OR public.is_super_admin(_user_id);
$$;

CREATE POLICY "Inbox admins select"
ON public.email_inbox_messages FOR SELECT
TO authenticated
USING (public.can_access_email_inbox(auth.uid()));

CREATE POLICY "Inbox admins update"
ON public.email_inbox_messages FOR UPDATE
TO authenticated
USING (public.can_access_email_inbox(auth.uid()))
WITH CHECK (public.can_access_email_inbox(auth.uid()));

CREATE POLICY "Inbox admins delete"
ON public.email_inbox_messages FOR DELETE
TO authenticated
USING (public.can_access_email_inbox(auth.uid()));

CREATE POLICY "Inbox admins insert"
ON public.email_inbox_messages FOR INSERT
TO authenticated
WITH CHECK (public.can_access_email_inbox(auth.uid()));

CREATE TRIGGER trg_email_inbox_messages_updated_at
BEFORE UPDATE ON public.email_inbox_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.email_inbox_state (
  id INT PRIMARY KEY DEFAULT 1,
  last_uid BIGINT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.email_inbox_state(id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.email_inbox_state TO authenticated;
GRANT ALL ON public.email_inbox_state TO service_role;
ALTER TABLE public.email_inbox_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inbox admins view state"
ON public.email_inbox_state FOR SELECT TO authenticated
USING (public.can_access_email_inbox(auth.uid()));
