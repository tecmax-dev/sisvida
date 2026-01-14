-- Tabela para armazenar mensagens da Ouvidoria do app mobile
CREATE TABLE public.ouvidoria_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  patient_cpf TEXT,
  patient_phone TEXT,
  patient_email TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('sugestao', 'elogio', 'reclamacao', 'denuncia')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'archived')),
  admin_notes TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ouvidoria_messages_clinic_id ON public.ouvidoria_messages(clinic_id);
CREATE INDEX idx_ouvidoria_messages_patient_id ON public.ouvidoria_messages(patient_id);
CREATE INDEX idx_ouvidoria_messages_status ON public.ouvidoria_messages(status);
CREATE INDEX idx_ouvidoria_messages_message_type ON public.ouvidoria_messages(message_type);
CREATE INDEX idx_ouvidoria_messages_created_at ON public.ouvidoria_messages(created_at DESC);

-- RLS
ALTER TABLE public.ouvidoria_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Admins podem ver e gerenciar
CREATE POLICY "Super admins can manage ouvidoria messages"
  ON public.ouvidoria_messages
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Union admins can manage ouvidoria messages"
  ON public.ouvidoria_messages
  FOR ALL
  USING (public.has_union_module_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_union_module_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can view ouvidoria messages"
  ON public.ouvidoria_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.clinic_id = ouvidoria_messages.clinic_id
      AND ur.role IN ('owner', 'admin')
    )
  );

-- Política para inserção pública (app mobile - sem auth)
CREATE POLICY "Anyone can submit ouvidoria messages"
  ON public.ouvidoria_messages
  FOR INSERT
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ouvidoria_messages_updated_at
  BEFORE UPDATE ON public.ouvidoria_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();