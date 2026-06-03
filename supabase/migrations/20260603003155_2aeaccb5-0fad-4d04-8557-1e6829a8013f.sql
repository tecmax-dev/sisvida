-- Tabela persistente para lembrar identificação de usuário WhatsApp por telefone.
-- Quando o telefone do remetente coincide com o phone do cadastro (patients.phone),
-- pulamos a etapa de CPF nos fluxos de agendamento e atualização de carteirinha.
-- Quando não coincide, o CPF é solicitado uma única vez e a relação telefone↔patient
-- fica salva aqui para próximas interações.

CREATE TABLE IF NOT EXISTS public.whatsapp_phone_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  phone TEXT NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  identified_via TEXT NOT NULL DEFAULT 'cpf',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_phone_identity TO authenticated;
GRANT ALL ON public.whatsapp_phone_identity TO service_role;

ALTER TABLE public.whatsapp_phone_identity ENABLE ROW LEVEL SECURITY;

-- Acesso apenas para administradores da clínica (service role já bypassa RLS).
CREATE POLICY "Clinic admins can view phone identity"
ON public.whatsapp_phone_identity
FOR SELECT
TO authenticated
USING (public.has_clinic_access(auth.uid(), clinic_id));

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_identity_phone
  ON public.whatsapp_phone_identity (clinic_id, phone);
