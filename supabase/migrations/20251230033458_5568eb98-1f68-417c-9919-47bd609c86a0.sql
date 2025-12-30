-- Create pre-attendance table for vital signs
CREATE TABLE public.pre_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  
  -- Vital signs
  blood_pressure_systolic INTEGER, -- mmHg
  blood_pressure_diastolic INTEGER, -- mmHg
  heart_rate INTEGER, -- bpm
  temperature NUMERIC(4,1), -- Celsius
  weight NUMERIC(5,2), -- kg
  height NUMERIC(5,2), -- cm
  oxygen_saturation INTEGER, -- %
  glucose INTEGER, -- mg/dL
  
  notes TEXT,
  
  -- Metadata
  recorded_by UUID,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pre_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view pre-attendance of their clinics"
  ON public.pre_attendance FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can insert pre-attendance for their clinics"
  ON public.pre_attendance FOR INSERT
  WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can update pre-attendance of their clinics"
  ON public.pre_attendance FOR UPDATE
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can delete pre-attendance of their clinics"
  ON public.pre_attendance FOR DELETE
  USING (has_clinic_access(auth.uid(), clinic_id));

-- Index for faster lookups
CREATE INDEX idx_pre_attendance_appointment ON public.pre_attendance(appointment_id);
CREATE INDEX idx_pre_attendance_patient ON public.pre_attendance(patient_id);
CREATE INDEX idx_pre_attendance_clinic ON public.pre_attendance(clinic_id);

-- Unique constraint: one pre-attendance per appointment
CREATE UNIQUE INDEX idx_pre_attendance_unique_appointment ON public.pre_attendance(appointment_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_attendance;