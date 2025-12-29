-- Tabela de dependentes de pacientes
CREATE TABLE public.patient_dependents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT,
  birth_date DATE,
  relationship TEXT, -- Ex: filho, esposa, mãe, etc.
  card_number TEXT,
  card_expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_patient_dependents_patient_id ON public.patient_dependents(patient_id);
CREATE INDEX idx_patient_dependents_clinic_id ON public.patient_dependents(clinic_id);
CREATE INDEX idx_patient_dependents_cpf ON public.patient_dependents(cpf) WHERE cpf IS NOT NULL;

-- Índice único para evitar CPF duplicado por clínica
CREATE UNIQUE INDEX idx_patient_dependents_unique_cpf_clinic 
ON public.patient_dependents(clinic_id, cpf) 
WHERE cpf IS NOT NULL AND cpf != '';

-- Habilitar RLS
ALTER TABLE public.patient_dependents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Clinic members can view dependents"
ON public.patient_dependents
FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert dependents"
ON public.patient_dependents
FOR INSERT
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update dependents"
ON public.patient_dependents
FOR UPDATE
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can delete dependents"
ON public.patient_dependents
FOR DELETE
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_patient_dependents_updated_at
BEFORE UPDATE ON public.patient_dependents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_dependents;

-- Comentários para documentação
COMMENT ON TABLE public.patient_dependents IS 'Dependentes vinculados aos pacientes titulares';
COMMENT ON COLUMN public.patient_dependents.relationship IS 'Grau de parentesco: filho(a), cônjuge, pai, mãe, etc.';
COMMENT ON COLUMN public.patient_dependents.card_number IS 'Número da carteirinha do dependente';
COMMENT ON COLUMN public.patient_dependents.card_expires_at IS 'Data de vencimento da carteirinha do dependente';