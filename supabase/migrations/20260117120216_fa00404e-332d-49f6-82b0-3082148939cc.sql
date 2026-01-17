-- Adicionar coluna para configurar graus de parentesco permitidos na entidade sindical
ALTER TABLE public.union_entities
ADD COLUMN IF NOT EXISTS allowed_relationship_types JSONB DEFAULT '["conjuge", "filho", "pai", "mae", "irmao", "neto", "enteado", "outro"]'::jsonb;

-- Comentário explicativo
COMMENT ON COLUMN public.union_entities.allowed_relationship_types IS 'Lista de graus de parentesco permitidos para dependentes. Valores: conjuge, filho, pai, mae, irmao, neto, enteado, sobrinho, avo, tio, primo, outro';