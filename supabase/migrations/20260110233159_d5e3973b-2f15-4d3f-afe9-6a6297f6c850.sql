-- Índice único para CNPJ por clínica (ignorando nulos e vazios)
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_cnpj_clinic 
ON public.suppliers(clinic_id, cnpj) 
WHERE cnpj IS NOT NULL AND cnpj != '';