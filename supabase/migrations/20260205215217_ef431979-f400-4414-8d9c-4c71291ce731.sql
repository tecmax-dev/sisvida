-- Update existing patients with employer data from sindical_associados
UPDATE patients p
SET 
  employer_cnpj = s.empresa_cnpj,
  employer_name = COALESCE(s.empresa_nome_fantasia, s.empresa_razao_social)
FROM sindical_associados s
WHERE p.cpf = s.cpf
  AND s.status = 'ativo'
  AND (p.employer_cnpj IS NULL OR p.employer_cnpj = '')
  AND s.empresa_cnpj IS NOT NULL;

-- Create or replace function to sync employer data when sindical_associados is updated
CREATE OR REPLACE FUNCTION sync_employer_to_patient()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync when status is 'ativo' and employer data exists
  IF (NEW.status = 'ativo' AND NEW.empresa_cnpj IS NOT NULL) THEN
    UPDATE patients
    SET 
      employer_cnpj = NEW.empresa_cnpj,
      employer_name = COALESCE(NEW.empresa_nome_fantasia, NEW.empresa_razao_social)
    WHERE cpf = NEW.cpf
      AND (employer_cnpj IS NULL OR employer_cnpj = '');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to sync employer data on insert or update
DROP TRIGGER IF EXISTS sync_employer_on_associado_change ON sindical_associados;
CREATE TRIGGER sync_employer_on_associado_change
  AFTER INSERT OR UPDATE OF status, empresa_cnpj, empresa_razao_social, empresa_nome_fantasia
  ON sindical_associados
  FOR EACH ROW
  EXECUTE FUNCTION sync_employer_to_patient();