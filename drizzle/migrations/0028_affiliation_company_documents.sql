CREATE TABLE public.affiliation_company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  associado_id uuid,
  employer_id uuid NOT NULL,
  employer_cnpj text,
  worker_name text NOT NULL,
  worker_cpf text,
  source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','manual')),
  title text NOT NULL DEFAULT 'Ficha de filiação',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  version integer NOT NULL DEFAULT 1,
  approved_at timestamptz,
  made_available_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  opened_by_portal text,
  ack_status text NOT NULL DEFAULT 'pending' CHECK (ack_status IN ('pending','confirmed')),
  ack_at timestamptz,
  ack_by_name text,
  ack_portal_type text,
  ack_portal_id uuid,
  ack_document_version integer,
  classification_notice boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX affiliation_docs_auto_unique ON public.affiliation_company_documents(associado_id) WHERE source = 'auto';
CREATE INDEX affiliation_docs_employer_pending ON public.affiliation_company_documents(employer_id, ack_status);
GRANT SELECT, INSERT, UPDATE ON public.affiliation_company_documents TO authenticated;
GRANT ALL ON public.affiliation_company_documents TO service_role;
ALTER TABLE public.affiliation_company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff read affiliation docs" ON public.affiliation_company_documents FOR SELECT TO authenticated USING (public.has_clinic_access(auth.uid(), clinic_id));
CREATE POLICY "Clinic staff insert affiliation docs" ON public.affiliation_company_documents FOR INSERT TO authenticated WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id) AND source = 'manual');

CREATE TABLE public.affiliation_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  document_id uuid,
  associado_id uuid,
  employer_id uuid,
  event text NOT NULL,
  actor text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affiliation_events_doc ON public.affiliation_document_events(document_id, created_at);
CREATE INDEX affiliation_events_employer ON public.affiliation_document_events(employer_id, created_at);
GRANT SELECT ON public.affiliation_document_events TO authenticated;
GRANT ALL ON public.affiliation_document_events TO service_role;
ALTER TABLE public.affiliation_document_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff read affiliation events" ON public.affiliation_document_events FOR SELECT TO authenticated USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE TABLE public.affiliation_processing_jobs (
  associado_id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error','needs_employer')),
  card_id uuid,
  document_id uuid,
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliation_processing_jobs TO authenticated;
GRANT ALL ON public.affiliation_processing_jobs TO service_role;
ALTER TABLE public.affiliation_processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff read affiliation jobs" ON public.affiliation_processing_jobs FOR SELECT TO authenticated USING (public.has_clinic_access(auth.uid(), clinic_id));