-- Create enum for union entity types
CREATE TYPE public.union_entity_type AS ENUM ('sindicato', 'federacao', 'confederacao');

-- Create enum for union entity status
CREATE TYPE public.union_entity_status AS ENUM ('ativa', 'suspensa', 'em_analise', 'inativa');

-- Create enum for union entity coverage
CREATE TYPE public.union_entity_coverage AS ENUM ('municipal', 'estadual', 'nacional');

-- Create table for union entities
CREATE TABLE public.union_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Entity data
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT NOT NULL UNIQUE,
    entity_type union_entity_type NOT NULL DEFAULT 'sindicato',
    categoria_laboral TEXT,
    abrangencia union_entity_coverage DEFAULT 'municipal',
    
    -- Access data (linked to auth user)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email_institucional TEXT NOT NULL UNIQUE,
    
    -- Administrative data
    responsavel_legal TEXT,
    telefone TEXT,
    email_contato TEXT,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    
    -- Plan and status
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    status union_entity_status NOT NULL DEFAULT 'em_analise',
    
    -- Timestamps
    data_ativacao TIMESTAMP WITH TIME ZONE,
    ultimo_acesso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.union_entities ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_union_entities_cnpj ON public.union_entities(cnpj);
CREATE INDEX idx_union_entities_status ON public.union_entities(status);
CREATE INDEX idx_union_entities_user_id ON public.union_entities(user_id);
CREATE INDEX idx_union_entities_entity_type ON public.union_entities(entity_type);

-- RLS Policies

-- Super admins can do everything
CREATE POLICY "Super admins can manage union entities"
ON public.union_entities
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.super_admins
        WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.super_admins
        WHERE user_id = auth.uid()
    )
);

-- Union entity users can view their own entity
CREATE POLICY "Union entity users can view own entity"
ON public.union_entities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Union entity users can update their own entity (limited fields)
CREATE POLICY "Union entity users can update own entity"
ON public.union_entities
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create user role for union entity admin
DO $$
BEGIN
    -- Check if the role already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'public.app_role'::regtype 
        AND enumlabel = 'entidade_sindical_admin'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'entidade_sindical_admin';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
CREATE TRIGGER update_union_entities_updated_at
    BEFORE UPDATE ON public.union_entities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.union_entities IS 'Cadastro de entidades sindicais (sindicatos, federações, confederações)';
COMMENT ON COLUMN public.union_entities.razao_social IS 'Razão social da entidade';
COMMENT ON COLUMN public.union_entities.cnpj IS 'CNPJ da entidade (único)';
COMMENT ON COLUMN public.union_entities.entity_type IS 'Tipo: sindicato, federação ou confederação';
COMMENT ON COLUMN public.union_entities.categoria_laboral IS 'Categoria laboral representada';
COMMENT ON COLUMN public.union_entities.abrangencia IS 'Abrangência territorial';
COMMENT ON COLUMN public.union_entities.status IS 'Status da conta da entidade';