-- Tabela exclusiva do módulo sindical para associados/sócios
CREATE TABLE public.sindical_associados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Vinculação ao sindicato (entidade sindical)
    sindicato_id UUID NOT NULL REFERENCES public.union_entities(id) ON DELETE CASCADE,
    
    -- Dados Pessoais
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL,
    rg TEXT,
    data_nascimento DATE NOT NULL,
    sexo TEXT,
    estado_civil TEXT,
    
    -- Contato
    telefone TEXT NOT NULL,
    email TEXT NOT NULL,
    
    -- Endereço
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    
    -- Dados Profissionais
    empresa TEXT,
    cargo TEXT,
    tipo_vinculo TEXT,
    
    -- Dados da Filiação
    categoria_id UUID,
    valor_contribuicao NUMERIC(10,2) DEFAULT 0,
    forma_pagamento TEXT,
    
    -- Documentos (URLs do Storage)
    documento_foto_url TEXT,
    documento_rg_url TEXT,
    documento_comprovante_url TEXT,
    
    -- Aceite LGPD
    aceite_lgpd BOOLEAN NOT NULL DEFAULT false,
    aceite_lgpd_at TIMESTAMP WITH TIME ZONE,
    
    -- Status e controle
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo', 'inativo', 'rejeitado')),
    observacoes TEXT,
    aprovado_por UUID,
    aprovado_at TIMESTAMP WITH TIME ZONE,
    rejeitado_por UUID,
    rejeitado_at TIMESTAMP WITH TIME ZONE,
    motivo_rejeicao TEXT,
    
    -- Auditoria
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice único para evitar duplicidade de CPF por sindicato
CREATE UNIQUE INDEX idx_sindical_associados_cpf_sindicato 
ON public.sindical_associados(sindicato_id, cpf);

-- Índice para busca por status
CREATE INDEX idx_sindical_associados_status 
ON public.sindical_associados(sindicato_id, status);

-- Índice para busca por email
CREATE INDEX idx_sindical_associados_email 
ON public.sindical_associados(sindicato_id, email);

-- Enable RLS
ALTER TABLE public.sindical_associados ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer pessoa pode fazer INSERT (página pública de filiação)
CREATE POLICY "Público pode solicitar filiação"
ON public.sindical_associados
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Política: Admins de entidades sindicais podem visualizar associados do seu sindicato
CREATE POLICY "Admins de entidades sindicais podem visualizar associados"
ON public.sindical_associados
FOR SELECT
TO authenticated
USING (
    has_union_entity_access(auth.uid())
    OR is_super_admin(auth.uid())
);

-- Política: Admins de entidades sindicais podem atualizar associados do seu sindicato
CREATE POLICY "Admins de entidades sindicais podem atualizar associados"
ON public.sindical_associados
FOR UPDATE
TO authenticated
USING (
    has_union_entity_access(auth.uid())
    OR is_super_admin(auth.uid())
)
WITH CHECK (
    has_union_entity_access(auth.uid())
    OR is_super_admin(auth.uid())
);

-- Política: Admins de entidades sindicais podem deletar associados do seu sindicato
CREATE POLICY "Admins de entidades sindicais podem deletar associados"
ON public.sindical_associados
FOR DELETE
TO authenticated
USING (
    has_union_entity_access(auth.uid())
    OR is_super_admin(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sindical_associados_updated_at
BEFORE UPDATE ON public.sindical_associados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de categorias de sócios (exclusiva do módulo sindical)
CREATE TABLE public.sindical_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sindicato_id UUID NOT NULL REFERENCES public.union_entities(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor_contribuicao NUMERIC(10,2) DEFAULT 0,
    periodicidade TEXT DEFAULT 'mensal' CHECK (periodicidade IN ('mensal', 'trimestral', 'semestral', 'anual')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice único para nome de categoria por sindicato
CREATE UNIQUE INDEX idx_sindical_categorias_nome_sindicato 
ON public.sindical_categorias(sindicato_id, nome);

-- Enable RLS
ALTER TABLE public.sindical_categorias ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer pessoa pode visualizar categorias ativas (para o formulário público)
CREATE POLICY "Público pode visualizar categorias ativas"
ON public.sindical_categorias
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Política: Admins podem gerenciar categorias
CREATE POLICY "Admins de entidades sindicais podem gerenciar categorias"
ON public.sindical_categorias
FOR ALL
TO authenticated
USING (
    has_union_entity_access(auth.uid())
    OR is_super_admin(auth.uid())
)
WITH CHECK (
    has_union_entity_access(auth.uid())
    OR is_super_admin(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sindical_categorias_updated_at
BEFORE UPDATE ON public.sindical_categorias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Foreign key de categoria_id para categorias
ALTER TABLE public.sindical_associados
ADD CONSTRAINT fk_sindical_associados_categoria
FOREIGN KEY (categoria_id) REFERENCES public.sindical_categorias(id) ON DELETE SET NULL;

-- Criar bucket de storage para documentos de associados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'sindical-documentos',
    'sindical-documentos',
    false,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para documentos de associados
-- Permitir upload público (para o formulário de filiação)
CREATE POLICY "Público pode fazer upload de documentos de filiação"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'sindical-documentos');

-- Admins podem visualizar documentos
CREATE POLICY "Admins podem visualizar documentos de associados"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'sindical-documentos'
    AND (
        has_union_entity_access(auth.uid())
        OR is_super_admin(auth.uid())
    )
);

-- Admins podem deletar documentos
CREATE POLICY "Admins podem deletar documentos de associados"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'sindical-documentos'
    AND (
        has_union_entity_access(auth.uid())
        OR is_super_admin(auth.uid())
    )
);