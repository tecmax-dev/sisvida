
-- =====================================================
-- CORREÇÃO DE PROFISSIONAIS DUPLICADOS
-- =====================================================

-- 1. Consolidar profissionais duplicados: manter o mais antigo (com agendamentos),
--    transferir user_id do mais recente, e desativar os duplicados

-- Primeiro, vamos transferir os user_ids dos registros duplicados mais recentes
-- para os registros originais (mais antigos que têm os agendamentos)

-- Atualizar "Juliane Leite" - transferir user_id para o registro original
UPDATE professionals 
SET user_id = '50162298-7e25-43cb-9de1-7787a2e2601f'
WHERE id = '3a79f7b1-adcf-417e-8896-22c707bd963b'
AND user_id IS NULL;

-- Atualizar "Uiara Tiuba" - transferir user_id para o registro original  
UPDATE professionals 
SET user_id = '77e7bb47-9f5a-4764-b6e3-6b24f652e5e8'
WHERE id = '4012d4ac-ec6f-455e-b0bd-cd7d565c7abe'
AND user_id IS NULL;

-- Atualizar user_roles para apontar para os profissionais corretos
UPDATE user_roles
SET professional_id = '3a79f7b1-adcf-417e-8896-22c707bd963b'
WHERE professional_id = 'e90995a0-ca21-4693-8c7c-b8088b977222';

UPDATE user_roles
SET professional_id = '4012d4ac-ec6f-455e-b0bd-cd7d565c7abe'
WHERE professional_id = '04bf8e53-8738-4a4e-9a27-7995e43dd878';

-- Desativar os registros duplicados (os mais recentes sem agendamentos)
UPDATE professionals 
SET is_active = false, 
    name = name || ' (DUPLICADO - DESATIVADO)'
WHERE id IN ('e90995a0-ca21-4693-8c7c-b8088b977222', '04bf8e53-8738-4a4e-9a27-7995e43dd878');

-- 2. Criar constraint de unicidade para evitar futuras duplicações
-- Primeiro, criar um índice único parcial que permite múltiplos registros inativos
-- mas apenas um ativo por combinação de name + clinic_id

-- Índice único para user_id + clinic_id (um usuário só pode ser um profissional por clínica)
CREATE UNIQUE INDEX IF NOT EXISTS idx_professionals_user_clinic_unique 
ON professionals (user_id, clinic_id) 
WHERE user_id IS NOT NULL AND is_active = true;

-- 3. Criar função para verificar duplicação antes de inserir/atualizar
CREATE OR REPLACE FUNCTION check_professional_duplicate()
RETURNS TRIGGER AS $$
DECLARE
    existing_id uuid;
    existing_name text;
BEGIN
    -- Verificar se já existe profissional com mesmo user_id na clínica (se user_id foi informado)
    IF NEW.user_id IS NOT NULL AND NEW.is_active = true THEN
        SELECT id, name INTO existing_id, existing_name
        FROM professionals
        WHERE clinic_id = NEW.clinic_id
        AND user_id = NEW.user_id
        AND is_active = true
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        LIMIT 1;
        
        IF existing_id IS NOT NULL THEN
            RAISE EXCEPTION 'PROFISSIONAL_DUPLICADO: Já existe um profissional ativo (%) vinculado a este usuário nesta clínica. Por favor, edite o profissional existente.', existing_name;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para verificar duplicação
DROP TRIGGER IF EXISTS trigger_check_professional_duplicate ON professionals;
CREATE TRIGGER trigger_check_professional_duplicate
    BEFORE INSERT OR UPDATE ON professionals
    FOR EACH ROW
    EXECUTE FUNCTION check_professional_duplicate();
