-- Add telemedicine to appointment_type enum
ALTER TYPE appointment_type ADD VALUE IF NOT EXISTS 'telemedicine';

-- Create telemedicine_sessions table
CREATE TABLE public.telemedicine_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL,
  room_id TEXT NOT NULL UNIQUE,
  patient_token UUID NOT NULL DEFAULT gen_random_uuid(),
  professional_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'waiting',
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique indexes
CREATE UNIQUE INDEX idx_telemedicine_patient_token ON public.telemedicine_sessions(patient_token);
CREATE UNIQUE INDEX idx_telemedicine_professional_token ON public.telemedicine_sessions(professional_token);
CREATE INDEX idx_telemedicine_appointment ON public.telemedicine_sessions(appointment_id);
CREATE INDEX idx_telemedicine_clinic ON public.telemedicine_sessions(clinic_id);

-- Enable RLS
ALTER TABLE public.telemedicine_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view session by patient token"
ON public.telemedicine_sessions
FOR SELECT
USING (patient_token IS NOT NULL);

CREATE POLICY "Public can update session by patient token"
ON public.telemedicine_sessions
FOR UPDATE
USING (patient_token IS NOT NULL);

CREATE POLICY "Clinic staff can manage telemedicine sessions"
ON public.telemedicine_sessions
FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic staff can view telemedicine sessions"
ON public.telemedicine_sessions
FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.telemedicine_sessions;

-- Add telemedicine feature
INSERT INTO public.system_features (key, name, description, category, icon, is_active)
VALUES ('telemedicine', 'Telemedicina', 'Consultas por videochamada', 'atendimento', 'Video', true)
ON CONFLICT (key) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_telemedicine_sessions_updated_at
BEFORE UPDATE ON public.telemedicine_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();