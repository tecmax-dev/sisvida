-- Adicionar colunas sindicais na tabela patients para suportar aprovação de filiações
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS union_category_id UUID REFERENCES public.union_categories(id),
ADD COLUMN IF NOT EXISTS union_contribution_value NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS union_join_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS union_observations TEXT;

-- Índice para buscas por categoria sindical
CREATE INDEX IF NOT EXISTS idx_patients_union_category_id ON public.patients(union_category_id);

-- Comentários nas colunas
COMMENT ON COLUMN public.patients.union_category_id IS 'Categoria sindical do associado';
COMMENT ON COLUMN public.patients.union_contribution_value IS 'Valor da contribuição sindical mensal';
COMMENT ON COLUMN public.patients.union_join_date IS 'Data de filiação ao sindicato';
COMMENT ON COLUMN public.patients.union_observations IS 'Observações sobre a filiação sindical';