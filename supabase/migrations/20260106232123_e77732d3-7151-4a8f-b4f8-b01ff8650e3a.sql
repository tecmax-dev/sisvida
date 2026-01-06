-- =====================================================
-- ETAPA 1: Criar os novos tipos base (127 e 128)
-- =====================================================

-- Obter o clinic_id da clínica existente
DO $$
DECLARE
  v_clinic_id UUID;
  v_type_127_id UUID;
  v_type_128_id UUID;
  v_type_124_id UUID;
  v_type_125_id UUID;
  v_type_126_id UUID;
  v_mensalidade_id UUID;
BEGIN
  -- Buscar clinic_id dos tipos existentes
  SELECT clinic_id INTO v_clinic_id FROM contribution_types LIMIT 1;
  
  -- Buscar IDs dos tipos base existentes
  SELECT id INTO v_type_124_id FROM contribution_types 
    WHERE name = '124 - MENSALIDADE SINDICAL' AND clinic_id = v_clinic_id LIMIT 1;
  SELECT id INTO v_type_125_id FROM contribution_types 
    WHERE name = '125 - TAXA NEGOCIAL (MERCADOS)' AND clinic_id = v_clinic_id LIMIT 1;
  SELECT id INTO v_type_126_id FROM contribution_types 
    WHERE name = '126 - TAXA NEGOCIAL (COM VEREJ)' AND clinic_id = v_clinic_id LIMIT 1;
  SELECT id INTO v_mensalidade_id FROM contribution_types 
    WHERE name = 'Mensalidade' AND clinic_id = v_clinic_id LIMIT 1;

  -- Criar tipo 127 - NEGOCIAÇÃO DE DÉBITO (se não existir)
  INSERT INTO contribution_types (clinic_id, name, description, default_value, is_active)
  VALUES (v_clinic_id, '127 - NEGOCIAÇÃO DE DÉBITO', 'Parcelas de negociação de débitos em atraso', 0, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_type_127_id;
  
  -- Se não retornou (já existia), buscar o ID
  IF v_type_127_id IS NULL THEN
    SELECT id INTO v_type_127_id FROM contribution_types 
      WHERE name = '127 - NEGOCIAÇÃO DE DÉBITO' AND clinic_id = v_clinic_id;
  END IF;

  -- Criar tipo 128 - CONTRIBUIÇÃO INDIVIDUAL (se não existir)
  INSERT INTO contribution_types (clinic_id, name, description, default_value, is_active)
  VALUES (v_clinic_id, '128 - CONTRIBUIÇÃO INDIVIDUAL', 'Mensalidade individual de associados', 0, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_type_128_id;
  
  IF v_type_128_id IS NULL THEN
    SELECT id INTO v_type_128_id FROM contribution_types 
      WHERE name = '128 - CONTRIBUIÇÃO INDIVIDUAL' AND clinic_id = v_clinic_id;
  END IF;

  -- =====================================================
  -- ETAPA 2: Migrar contribuições para tipos base
  -- =====================================================

  -- Migrar tipos 127 - NEGOCIACAO DE DEBITO REFERENTE... para 127 base
  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_127_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE '127 - NEGOCIACAO DE DEBITO REFERENTE%'
    AND v_type_127_id IS NOT NULL;

  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_127_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE '127 - NEGOCIAÇÃO DE DÉBITO REFERENTE%'
    AND v_type_127_id IS NOT NULL;

  -- Migrar DEBITO NEGOCIADO REFERENTE... para 127 base
  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_127_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE 'DEBITO NEGOCIADO REFERENTE%'
    AND v_type_127_id IS NOT NULL;

  -- Migrar tipos 128 - MENSALIDADE INDIVIDUAL REFERENTE... para 128 base
  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_128_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE '128 - MENSALIDADE INDIVIDUAL REFERENTE%'
    AND v_type_128_id IS NOT NULL;

  -- Migrar 756 - MENSALIDADE SINDICAL REFERENTE... para 124
  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_124_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE '756 - MENSALIDADE SINDICAL%'
    AND v_type_124_id IS NOT NULL;

  -- Migrar 756 - TAXA NEGOCIAL- MERCADOS... para 125
  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_125_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE '756 - TAXA NEGOCIAL- MERCADOS%'
    AND v_type_125_id IS NOT NULL;

  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_125_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE '756 - TAXA NEGOCIAL - MERCADOS%'
    AND v_type_125_id IS NOT NULL;

  -- Migrar 756 - TAXA NEGOCIAL - COM VAREJISTA... para 126
  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_126_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE '756 - TAXA NEGOCIAL - COM VAREJISTA%'
    AND v_type_126_id IS NOT NULL;

  UPDATE employer_contributions ec
  SET contribution_type_id = v_type_126_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE '756 - TAXA NEGOCIAL- COM VAREJISTA%'
    AND v_type_126_id IS NOT NULL;

  -- Migrar Mensalidade - Mês/Ano e Mensalidade Sindical - Mês/Ano para Mensalidade
  UPDATE employer_contributions ec
  SET contribution_type_id = v_mensalidade_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND (ct.name LIKE 'Mensalidade - %' OR ct.name LIKE 'Mensalidade Sindical - %')
    AND v_mensalidade_id IS NOT NULL;

  -- Migrar LYTEX HOMOLOGACAO para Mensalidade (teste de homologação)
  UPDATE employer_contributions ec
  SET contribution_type_id = v_mensalidade_id
  FROM contribution_types ct
  WHERE ec.contribution_type_id = ct.id
    AND ct.name LIKE 'LYTEX HOMOLOGACAO%'
    AND v_mensalidade_id IS NOT NULL;

END $$;

-- =====================================================
-- ETAPA 3: Deletar tipos duplicados não utilizados
-- =====================================================

-- Deletar tipos que não têm mais contribuições vinculadas
DELETE FROM contribution_types
WHERE id NOT IN (
  SELECT DISTINCT contribution_type_id FROM employer_contributions
)
AND name NOT IN (
  '124 - MENSALIDADE SINDICAL',
  '125 - TAXA NEGOCIAL (MERCADOS)',
  '126 - TAXA NEGOCIAL (COM VEREJ)',
  '127 - NEGOCIAÇÃO DE DÉBITO',
  '128 - CONTRIBUIÇÃO INDIVIDUAL',
  'Mensalidade',
  'Contribuição Assistencial',
  'LOCAÇÃO DE ESPAÇO REUNIÃO'
);