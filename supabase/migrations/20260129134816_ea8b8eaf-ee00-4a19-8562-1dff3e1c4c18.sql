-- Tabela para armazenar notificações enviadas aos pacientes
CREATE TABLE public.patient_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'push',
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_patient_notifications_patient ON public.patient_notifications(patient_id, is_read, created_at DESC);
CREATE INDEX idx_patient_notifications_clinic ON public.patient_notifications(clinic_id, created_at DESC);

-- Habilitar RLS
ALTER TABLE public.patient_notifications ENABLE ROW LEVEL SECURITY;

-- Política: Pacientes podem ver suas próprias notificações
CREATE POLICY "Patients can view own notifications"
ON public.patient_notifications
FOR SELECT
USING (patient_id = (auth.jwt() ->> 'patient_id')::uuid);

-- Política: Pacientes podem marcar como lida
CREATE POLICY "Patients can mark as read"
ON public.patient_notifications
FOR UPDATE
USING (patient_id = (auth.jwt() ->> 'patient_id')::uuid)
WITH CHECK (patient_id = (auth.jwt() ->> 'patient_id')::uuid);

-- Política: Service role pode inserir (edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.patient_notifications
FOR INSERT
WITH CHECK (true);

-- Política: Admins da clínica podem ver todas
CREATE POLICY "Clinic admins can view all"
ON public.patient_notifications
FOR SELECT
USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_notifications;