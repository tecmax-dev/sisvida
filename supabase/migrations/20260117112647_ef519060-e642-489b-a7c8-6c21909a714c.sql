-- ============================================
-- EXTENSÃO DA TABELA sindical_associados
-- Para suportar filiação completa de associados
-- ============================================

-- Adicionar campos de empresa (busca por CNPJ)
ALTER TABLE public.sindical_associados 
ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES public.employers(id),
ADD COLUMN IF NOT EXISTS empresa_cnpj TEXT,
ADD COLUMN IF NOT EXISTS empresa_razao_social TEXT,
ADD COLUMN IF NOT EXISTS empresa_nome_fantasia TEXT,
ADD COLUMN IF NOT EXISTS empresa_endereco TEXT,
ADD COLUMN IF NOT EXISTS data_admissao DATE;

-- Adicionar campo de assinatura digital
ALTER TABLE public.sindical_associados 
ADD COLUMN IF NOT EXISTS assinatura_digital_url TEXT,
ADD COLUMN IF NOT EXISTS assinatura_aceite_desconto BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS assinatura_aceite_at TIMESTAMP WITH TIME ZONE;

-- Adicionar número de matrícula (gerado na aprovação)
ALTER TABLE public.sindical_associados 
ADD COLUMN IF NOT EXISTS matricula TEXT;

-- ============================================
-- TABELA DE DEPENDENTES DO ASSOCIADO
-- ============================================
CREATE TABLE IF NOT EXISTS public.sindical_associado_dependentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES public.sindical_associados(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    grau_parentesco TEXT NOT NULL,
    data_nascimento DATE NOT NULL,
    cpf TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para dependentes
ALTER TABLE public.sindical_associado_dependentes ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção pública (mesma lógica do formulário de filiação)
CREATE POLICY "Public can insert dependentes via form"
ON public.sindical_associado_dependentes
FOR INSERT
TO anon
WITH CHECK (true);

-- Política para usuários autenticados visualizarem dependentes de suas entidades
CREATE POLICY "Authenticated users can view dependentes"
ON public.sindical_associado_dependentes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sindical_associados sa
        JOIN public.union_entities ue ON ue.id = sa.sindicato_id
        WHERE sa.id = sindical_associado_dependentes.associado_id
        AND (
            is_super_admin(auth.uid())
            OR ue.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.clinic_id = ue.clinic_id
            )
        )
    )
);

-- Política para usuários autenticados gerenciarem dependentes
CREATE POLICY "Authenticated users can manage dependentes"
ON public.sindical_associado_dependentes
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sindical_associados sa
        JOIN public.union_entities ue ON ue.id = sa.sindicato_id
        WHERE sa.id = sindical_associado_dependentes.associado_id
        AND (
            is_super_admin(auth.uid())
            OR ue.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.clinic_id = ue.clinic_id
            )
        )
    )
);

-- ============================================
-- TABELA DE MÉTODOS DE PAGAMENTO CONFIGURÁVEIS
-- ============================================
CREATE TABLE IF NOT EXISTS public.sindical_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sindicato_id UUID NOT NULL REFERENCES public.union_entities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(sindicato_id, code)
);

-- RLS para métodos de pagamento
ALTER TABLE public.sindical_payment_methods ENABLE ROW LEVEL SECURITY;

-- Política para leitura pública (formulário de filiação)
CREATE POLICY "Public can view active payment methods"
ON public.sindical_payment_methods
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Política para gestão por administradores
CREATE POLICY "Admins can manage payment methods"
ON public.sindical_payment_methods
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.union_entities ue
        WHERE ue.id = sindical_payment_methods.sindicato_id
        AND (
            is_super_admin(auth.uid())
            OR ue.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.clinic_id = ue.clinic_id
            )
        )
    )
);

-- Inserir métodos de pagamento padrão para entidades existentes
INSERT INTO public.sindical_payment_methods (sindicato_id, name, code, description, order_index)
SELECT 
    id,
    unnest(ARRAY['Desconto em Folha', 'Boleto Bancário', 'PIX', 'Débito Automático']),
    unnest(ARRAY['desconto_folha', 'boleto', 'pix', 'debito_automatico']),
    unnest(ARRAY['Desconto direto na folha de pagamento', 'Pagamento via boleto bancário', 'Pagamento via PIX', 'Débito automático em conta']),
    unnest(ARRAY[1, 2, 3, 4])
FROM public.union_entities
WHERE status = 'ativa'
ON CONFLICT (sindicato_id, code) DO NOTHING;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sindical_payment_methods_sindicato 
ON public.sindical_payment_methods(sindicato_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sindical_associado_dependentes_associado
ON public.sindical_associado_dependentes(associado_id);