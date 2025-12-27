
-- =====================================================
-- FASE 4: CRM e Marketing Médico
-- =====================================================

-- 1. Segmentos de Pacientes
CREATE TABLE public.patient_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  patient_count INTEGER DEFAULT 0,
  is_dynamic BOOLEAN NOT NULL DEFAULT true,
  last_calculated_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_patient_segments_clinic ON public.patient_segments(clinic_id);
CREATE INDEX idx_patient_segments_active ON public.patient_segments(clinic_id, is_active) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.patient_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_segments_select" ON public.patient_segments
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "patient_segments_admin" ON public.patient_segments
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger
CREATE TRIGGER update_patient_segments_updated_at
  BEFORE UPDATE ON public.patient_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Pacientes em Segmentos
CREATE TABLE public.segment_patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_id UUID NOT NULL REFERENCES public.patient_segments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  removed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (segment_id, patient_id)
);

-- Índices
CREATE INDEX idx_segment_patients_segment ON public.segment_patients(segment_id);
CREATE INDEX idx_segment_patients_patient ON public.segment_patients(patient_id);

-- RLS
ALTER TABLE public.segment_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segment_patients_select" ON public.segment_patients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.patient_segments ps
      WHERE ps.id = segment_patients.segment_id
      AND has_clinic_access(auth.uid(), ps.clinic_id)
    )
  );

CREATE POLICY "segment_patients_admin" ON public.segment_patients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.patient_segments ps
      WHERE ps.id = segment_patients.segment_id
      AND is_clinic_admin(auth.uid(), ps.clinic_id)
    )
  );

-- 3. Campanhas de Marketing
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  segment_id UUID REFERENCES public.patient_segments(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  message_template TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_campaigns_clinic ON public.campaigns(clinic_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(clinic_id, status);
CREATE INDEX idx_campaigns_segment ON public.campaigns(segment_id);

-- RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select" ON public.campaigns
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "campaigns_admin" ON public.campaigns
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Fluxos de Automação
CREATE TABLE public.automation_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('post_appointment', 'birthday', 'return_reminder', 'inactive', 'custom')),
  trigger_config JSONB DEFAULT '{}'::jsonb,
  message_template TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  delay_hours INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices
CREATE INDEX idx_automation_flows_clinic ON public.automation_flows(clinic_id);
CREATE INDEX idx_automation_flows_trigger ON public.automation_flows(clinic_id, trigger_type);
CREATE INDEX idx_automation_flows_active ON public.automation_flows(clinic_id, is_active) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_flows_select" ON public.automation_flows
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "automation_flows_admin" ON public.automation_flows
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger
CREATE TRIGGER update_automation_flows_updated_at
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Consentimentos de Marketing (LGPD)
CREATE TABLE public.marketing_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'all')),
  consent_type TEXT NOT NULL CHECK (consent_type IN ('opt_in', 'opt_out')),
  consent_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  source TEXT,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoke_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_marketing_consents_clinic ON public.marketing_consents(clinic_id);
CREATE INDEX idx_marketing_consents_patient ON public.marketing_consents(patient_id);
CREATE INDEX idx_marketing_consents_channel ON public.marketing_consents(clinic_id, channel);

-- RLS
ALTER TABLE public.marketing_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_consents_select" ON public.marketing_consents
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "marketing_consents_admin" ON public.marketing_consents
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Permitir insert público para captação de consentimento
CREATE POLICY "marketing_consents_public_insert" ON public.marketing_consents
  FOR INSERT WITH CHECK (true);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_segments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_flows;
