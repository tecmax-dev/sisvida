-- Create table for birthday message history
CREATE TABLE public.birthday_message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.birthday_message_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Clinic members can view birthday logs"
ON public.birthday_message_logs
FOR SELECT
USING (clinic_id IN (SELECT public.get_user_clinic_ids(auth.uid())));

CREATE POLICY "Service role can insert birthday logs"
ON public.birthday_message_logs
FOR INSERT
WITH CHECK (true);

-- Add birthday_enabled and birthday_message columns to clinics
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS birthday_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS birthday_message TEXT DEFAULT 'Olá {nome}! 🎂🎉

A equipe da {clinica} deseja a você um feliz aniversário!

Que este dia seja repleto de alegrias e realizações.

Com carinho,
Equipe {clinica}';

-- Create index for efficient queries
CREATE INDEX idx_birthday_logs_clinic_sent ON public.birthday_message_logs(clinic_id, sent_at DESC);
CREATE INDEX idx_patients_birth_date ON public.patients(clinic_id, birth_date);

-- Enable realtime for birthday logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.birthday_message_logs;