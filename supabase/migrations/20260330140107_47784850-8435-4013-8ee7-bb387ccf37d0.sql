CREATE UNIQUE INDEX idx_union_suppliers_clinic_cnpj_active 
ON public.union_suppliers (clinic_id, (regexp_replace(cnpj, '[^0-9]', '', 'g'))) 
WHERE cnpj IS NOT NULL AND cnpj != '' AND is_active = true;