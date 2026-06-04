
CREATE TABLE public.sms_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  meta_template_name TEXT UNIQUE,
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Union users manage sms templates" ON public.sms_templates FOR ALL TO authenticated
USING (public.is_union_context(auth.uid()))
WITH CHECK (public.is_union_context(auth.uid()));

CREATE TABLE public.sms_send_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.sms_templates(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  rendered_body TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_response JSONB,
  error TEXT,
  sent_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sms_send_logs TO authenticated;
GRANT ALL ON public.sms_send_logs TO service_role;
ALTER TABLE public.sms_send_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Union users view sms logs" ON public.sms_send_logs FOR SELECT TO authenticated
USING (public.is_union_context(auth.uid()));
CREATE POLICY "Union users insert sms logs" ON public.sms_send_logs FOR INSERT TO authenticated
WITH CHECK (public.is_union_context(auth.uid()));

CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON public.sms_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
