GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_inbox_messages TO authenticated;
GRANT ALL ON public.email_inbox_messages TO service_role;