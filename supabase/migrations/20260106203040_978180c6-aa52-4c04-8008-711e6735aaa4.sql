-- Adiciona coluna dependent_id na tabela medical_records
ALTER TABLE public.medical_records 
ADD COLUMN dependent_id UUID REFERENCES public.patient_dependents(id);

-- Preenche retroativamente baseado nos appointments existentes
UPDATE public.medical_records mr
SET dependent_id = a.dependent_id
FROM public.appointments a
WHERE mr.appointment_id = a.id
  AND a.dependent_id IS NOT NULL;

-- Cria índice para performance nas buscas
CREATE INDEX idx_medical_records_dependent_id ON public.medical_records(dependent_id);