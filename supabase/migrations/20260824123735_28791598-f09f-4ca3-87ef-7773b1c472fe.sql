create table if not exists public.patient_signature_tokens (
    id uuid primary key default gen_random_uuid(),
    token uuid not null unique default gen_random_uuid(),
    patient_id uuid references public.patients(id) on delete cascade not null,
    clinic_id uuid references public.clinics(id) on delete cascade not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz default now()
);

grant select, insert, update on public.patient_signature_tokens to authenticated;
grant all on public.patient_signature_tokens to service_role;

alter table public.patient_signature_tokens enable row level security;

create policy "Service role has full access" on public.patient_signature_tokens
    for all to service_role using (true);
