-- Garantir que anon pode verificar union_entities para FK validation no formulário de filiação
-- A política existente restringe por status='ativa', mas a FK validation precisa de acesso mais amplo
-- Criar política que permite anon verificar existência para FK

-- Verificar se já existe política para anon em union_entities (complementar)
CREATE POLICY "Anon can verify union entity exists for filiacao FK"
ON public.union_entities
FOR SELECT
TO anon
USING (true);

-- Nota: Esta política sobrescreve a restrição de status='ativa' para anon
-- Considere que authenticated já tem políticas mais específicas