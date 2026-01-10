-- Adicionar coluna de nomenclatura na tabela clinics
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS entity_nomenclature TEXT DEFAULT 'Paciente';

-- Comentário explicativo
COMMENT ON COLUMN public.clinics.entity_nomenclature IS 
'Nomenclatura utilizada para se referir ao cadastro titular de Pessoa Física (ex: Paciente, Associado, Filiado, Cliente, Beneficiário)';