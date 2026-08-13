create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

CREATE TYPE public.whatsapp_one_shot_status AS ENUM ('authorized', 'used', 'expired', 'failed');

CREATE TABLE public.whatsapp_one_shot_authorizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
    cpf text NOT NULL,
    phone text NOT NULL,
    template_name text NOT NULL,
    template_language text DEFAULT 'pt_BR',
    idempotency_key text UNIQUE NOT NULL,
    status public.whatsapp_one_shot_status DEFAULT 'authorized',
    authorized_by uuid REFERENCES auth.users(id),
    expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '1 hour'),
    used_at timestamp with time zone,
    result_payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_one_shot_authorizations TO authenticated;
GRANT ALL ON public.whatsapp_one_shot_authorizations TO service_role;

ALTER TABLE public.whatsapp_one_shot_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage one-shots" ON public.whatsapp_one_shot_authorizations
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.whatsapp_one_shot_authorizations 
(clinic_id, patient_id, cpf, phone, template_name, idempotency_key, status)
VALUES 
(
    '89e7585e-7bce-4e58-91fa-c37080d1170d', 
    '33cbf500-6a57-45e4-89e9-c6825fb13084', 
    '55905552568', 
    '73988633535', 
    'carteirinha_atualizacao_necessaria', 
    'one-shot-test-v1-55905552568', 
    'authorized'
);