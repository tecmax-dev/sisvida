CREATE TABLE public.professional_agenda_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  clinic_id uuid not null,
  agenda_date date not null,
  expires_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz
);
GRANT ALL ON public.professional_agenda_links TO service_role;
ALTER TABLE public.professional_agenda_links ENABLE ROW LEVEL SECURITY;