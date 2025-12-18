-- Create table for odontogram records
CREATE TABLE public.odontogram_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  tooth_number INTEGER NOT NULL CHECK (tooth_number >= 11 AND tooth_number <= 85),
  tooth_face VARCHAR(10), -- vestibular, lingual, mesial, distal, oclusal, incisal
  condition VARCHAR(50) NOT NULL, -- caries, restoration, extraction, crown, implant, root_canal, etc
  material VARCHAR(50), -- amalgam, resin, ceramic, metal, etc
  notes TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.odontogram_records ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view odontogram records of their clinics"
ON public.odontogram_records
FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage odontogram records of their clinics"
ON public.odontogram_records
FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

-- Create index for faster queries
CREATE INDEX idx_odontogram_patient ON public.odontogram_records(patient_id);
CREATE INDEX idx_odontogram_tooth ON public.odontogram_records(patient_id, tooth_number);

-- Add trigger for updated_at
CREATE TRIGGER update_odontogram_records_updated_at
BEFORE UPDATE ON public.odontogram_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();