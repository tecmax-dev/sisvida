-- Tabela para vincular fornecedores a categorias e descrições padrão para lançamento rápido
CREATE TABLE public.union_supplier_defaults (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.union_suppliers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.union_financial_categories(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    default_value NUMERIC(12,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_supplier_description UNIQUE (supplier_id, description)
);

-- Índices para performance
CREATE INDEX idx_union_supplier_defaults_clinic ON public.union_supplier_defaults(clinic_id);
CREATE INDEX idx_union_supplier_defaults_supplier ON public.union_supplier_defaults(supplier_id);
CREATE INDEX idx_union_supplier_defaults_category ON public.union_supplier_defaults(category_id);

-- Enable RLS
ALTER TABLE public.union_supplier_defaults ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view supplier defaults for their clinic"
ON public.union_supplier_defaults FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.clinic_id = union_supplier_defaults.clinic_id
    )
    OR EXISTS (
        SELECT 1 FROM public.super_admins sa 
        WHERE sa.user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage supplier defaults for their clinic"
ON public.union_supplier_defaults FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.clinic_id = union_supplier_defaults.clinic_id
    )
    OR EXISTS (
        SELECT 1 FROM public.super_admins sa 
        WHERE sa.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.clinic_id = union_supplier_defaults.clinic_id
    )
    OR EXISTS (
        SELECT 1 FROM public.super_admins sa 
        WHERE sa.user_id = auth.uid()
    )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_union_supplier_defaults_updated_at
    BEFORE UPDATE ON public.union_supplier_defaults
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();