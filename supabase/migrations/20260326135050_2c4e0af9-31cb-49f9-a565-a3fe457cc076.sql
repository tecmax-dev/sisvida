
-- Backfill mother_name and father_name from sindical_associados to patients
UPDATE patients p
SET 
  mother_name = COALESCE(p.mother_name, sa.nome_mae),
  father_name = COALESCE(p.father_name, sa.nome_pai)
FROM sindical_associados sa
WHERE regexp_replace(p.cpf, '\D', '', 'g') = regexp_replace(sa.cpf, '\D', '', 'g')
  AND sa.status = 'ativo'
  AND (sa.nome_mae IS NOT NULL OR sa.nome_pai IS NOT NULL)
  AND (p.mother_name IS NULL OR p.father_name IS NULL);
