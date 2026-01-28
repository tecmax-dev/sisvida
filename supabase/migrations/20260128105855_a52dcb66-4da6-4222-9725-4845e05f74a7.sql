-- Criar índice único para CPF + clinic_id para evitar duplicados de pacientes/sócios
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_unique_cpf_clinic 
ON public.patients (clinic_id, regexp_replace(cpf, '[^0-9]', '', 'g'))
WHERE cpf IS NOT NULL AND cpf != '';

-- Criar índice único para CNPJ + clinic_id para evitar duplicados de empregadores
CREATE UNIQUE INDEX IF NOT EXISTS idx_employers_unique_cnpj_clinic 
ON public.employers (clinic_id, regexp_replace(cnpj, '[^0-9]', '', 'g'))
WHERE cnpj IS NOT NULL AND cnpj != '';