-- Add CNAE fields to employers table
ALTER TABLE public.employers 
ADD COLUMN cnae_code TEXT,
ADD COLUMN cnae_description TEXT;

-- Add index for CNAE lookups
CREATE INDEX idx_employers_cnae_code ON public.employers(cnae_code);

-- Add comment for documentation
COMMENT ON COLUMN public.employers.cnae_code IS 'Código CNAE principal da empresa (atividade econômica)';
COMMENT ON COLUMN public.employers.cnae_description IS 'Descrição da atividade econômica principal';