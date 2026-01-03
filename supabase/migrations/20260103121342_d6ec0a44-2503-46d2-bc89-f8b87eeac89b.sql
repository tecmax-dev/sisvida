-- 1. Tabela para pesquisas NPS pós-atendimento
CREATE TABLE public.nps_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  score INTEGER CHECK (score >= 0 AND score <= 10),
  feedback TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  response_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view their NPS surveys"
  ON public.nps_surveys FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage NPS surveys"
  ON public.nps_surveys FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- Index for faster lookups
CREATE INDEX idx_nps_surveys_clinic ON public.nps_surveys(clinic_id);
CREATE INDEX idx_nps_surveys_token ON public.nps_surveys(response_token);

-- 2. Tabela para configurações de NPS por clínica
CREATE TABLE public.nps_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  delay_hours INTEGER DEFAULT 2,
  message_template TEXT DEFAULT 'Olá {nome}! Como foi seu atendimento conosco? Avalie de 0 a 10 clicando no link: {link}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view NPS settings"
  ON public.nps_settings FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage NPS settings"
  ON public.nps_settings FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

-- 3. Tabela para resultados de exames
CREATE TABLE public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view exam results"
  ON public.exam_results FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert exam results"
  ON public.exam_results FOR INSERT
  WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage exam results"
  ON public.exam_results FOR UPDATE
  USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can delete exam results"
  ON public.exam_results FOR DELETE
  USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE INDEX idx_exam_results_clinic ON public.exam_results(clinic_id);
CREATE INDEX idx_exam_results_patient ON public.exam_results(patient_id);

-- 4. Adicionar campos na waiting_list para notificação automática
ALTER TABLE public.waiting_list 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS slot_offered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS slot_expires_at TIMESTAMPTZ;

-- 5. Função para notificar lista de espera quando vaga abre
CREATE OR REPLACE FUNCTION public.notify_waiting_list_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  waiting_patient RECORD;
  supabase_url TEXT := 'https://eahhszmbyxapxzilfdlo.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaGhzem1ieXhhcHh6aWxmZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTU5MjYsImV4cCI6MjA4MTUzMTkyNn0.htkBUD0WjXQT8C1Wr4vTuTI_uanKPxe0NEk7QwHAPkU';
BEGIN
  -- Só processa quando status muda para 'cancelled'
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Busca primeiro paciente na lista de espera para este profissional/data
    SELECT wl.*, p.name as patient_name, p.phone as patient_phone
    INTO waiting_patient
    FROM public.waiting_list wl
    JOIN public.patients p ON p.id = wl.patient_id
    WHERE wl.clinic_id = NEW.clinic_id
      AND wl.professional_id = NEW.professional_id
      AND wl.status = 'waiting'
      AND wl.notification_sent = false
      AND (wl.preferred_date IS NULL OR wl.preferred_date = NEW.appointment_date)
    ORDER BY wl.priority DESC, wl.created_at ASC
    LIMIT 1;
    
    IF waiting_patient.id IS NOT NULL AND waiting_patient.patient_phone IS NOT NULL THEN
      -- Chama edge function para notificar
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/notify-waiting-list',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || supabase_anon_key
        ),
        body := jsonb_build_object(
          'waiting_list_id', waiting_patient.id,
          'clinic_id', NEW.clinic_id,
          'patient_id', waiting_patient.patient_id,
          'patient_name', waiting_patient.patient_name,
          'patient_phone', waiting_patient.patient_phone,
          'available_date', NEW.appointment_date,
          'available_time', NEW.start_time,
          'professional_id', NEW.professional_id
        )
      );
      
      -- Marca como notificado
      UPDATE public.waiting_list
      SET notification_sent = true,
          notification_sent_at = now(),
          slot_offered_at = now(),
          slot_expires_at = now() + interval '2 hours'
      WHERE id = waiting_patient.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para notificar lista de espera
DROP TRIGGER IF EXISTS trigger_notify_waiting_list ON public.appointments;
CREATE TRIGGER trigger_notify_waiting_list
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_waiting_list_on_cancellation();

-- 6. Função para enviar NPS após atendimento
CREATE OR REPLACE FUNCTION public.trigger_nps_survey()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  patient_record RECORD;
  nps_config RECORD;
  supabase_url TEXT := 'https://eahhszmbyxapxzilfdlo.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaGhzem1ieXhhcHh6aWxmZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTU5MjYsImV4cCI6MjA4MTUzMTkyNn0.htkBUD0WjXQT8C1Wr4vTuTI_uanKPxe0NEk7QwHAPkU';
BEGIN
  -- Só processa quando status muda para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Verifica se NPS está habilitado para a clínica
    SELECT * INTO nps_config FROM public.nps_settings WHERE clinic_id = NEW.clinic_id AND is_enabled = true;
    
    IF nps_config.id IS NOT NULL THEN
      -- Busca dados do paciente
      SELECT name, phone INTO patient_record FROM public.patients WHERE id = NEW.patient_id;
      
      IF patient_record.phone IS NOT NULL THEN
        -- Agenda envio do NPS
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-nps-survey',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || supabase_anon_key
          ),
          body := jsonb_build_object(
            'clinic_id', NEW.clinic_id,
            'patient_id', NEW.patient_id,
            'patient_name', patient_record.name,
            'patient_phone', patient_record.phone,
            'appointment_id', NEW.id,
            'professional_id', NEW.professional_id,
            'delay_hours', COALESCE(nps_config.delay_hours, 2)
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para NPS
DROP TRIGGER IF EXISTS trigger_nps_after_appointment ON public.appointments;
CREATE TRIGGER trigger_nps_after_appointment
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_nps_survey();

-- Enable realtime for NPS
ALTER PUBLICATION supabase_realtime ADD TABLE public.nps_surveys;