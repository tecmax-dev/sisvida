CREATE TABLE public.employer_portal_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'generate_boleto',
  phone text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.employer_portal_link_tokens TO service_role;
ALTER TABLE public.employer_portal_link_tokens ENABLE ROW LEVEL SECURITY;