-- Adicionar campo de número de matrícula na tabela employers
ALTER TABLE public.employers
ADD COLUMN registration_number TEXT;

-- Criar índice único para garantir que não haja duplicatas por clínica
CREATE UNIQUE INDEX idx_employers_registration_number_clinic 
ON public.employers (clinic_id, registration_number) 
WHERE registration_number IS NOT NULL;