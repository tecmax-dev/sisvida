create table if not exists public.card_update_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  ip_address text,
  user_agent text
);

create index if not exists idx_card_update_tokens_token on public.card_update_tokens(token);
create index if not exists idx_card_update_tokens_patient on public.card_update_tokens(patient_id);

grant all on public.card_update_tokens to service_role;

alter table public.card_update_tokens enable row level security;
