-- 1. Tabela para registro de decisões de negócio Inbound
CREATE TABLE public.whatsapp_inbound_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
    phone text NOT NULL,
    inbound_event text NOT NULL,
    decision text NOT NULL, -- REQUEST_PAYSLIP, CARD_ALREADY_OK, etc.
    payload jsonb DEFAULT '{}',
    request_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_inbound_decisions TO authenticated;
GRANT ALL ON public.whatsapp_inbound_decisions TO service_role;

-- RLS
ALTER TABLE public.whatsapp_inbound_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can view inbound decisions" 
ON public.whatsapp_inbound_decisions
FOR SELECT
TO authenticated
USING (public.is_clinic_admin(auth.uid(), clinic_id) OR public.is_super_admin());

-- 2. Garantir permissões nas tabelas existentes para a Edge Function service_role
GRANT ALL ON public.whatsapp_outbox TO service_role;
GRANT ALL ON public.whatsapp_events TO service_role;
GRANT ALL ON public.whatsapp_meta_templates TO service_role;
GRANT ALL ON public.whatsapp_consents TO service_role;
GRANT ALL ON public.whatsapp_opt_outs TO service_role;
GRANT ALL ON public.contact_preferences TO service_role;
GRANT ALL ON public.patients TO service_role;
GRANT ALL ON public.clinics TO service_role;
