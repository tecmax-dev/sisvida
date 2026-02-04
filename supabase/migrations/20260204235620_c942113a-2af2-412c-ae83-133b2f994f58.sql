-- Tabela para boletos de assinatura de clínicas
CREATE TABLE public.subscription_invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    
    -- Competência
    competence_month INTEGER NOT NULL CHECK (competence_month >= 1 AND competence_month <= 12),
    competence_year INTEGER NOT NULL CHECK (competence_year >= 2020),
    
    -- Valores (em centavos)
    value_cents INTEGER NOT NULL CHECK (value_cents >= 0),
    paid_value_cents INTEGER,
    fee_cents INTEGER DEFAULT 0,
    net_value_cents INTEGER,
    
    -- Datas
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Status: pending, paid, overdue, cancelled
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    
    -- Integração Lytex
    lytex_invoice_id TEXT,
    lytex_client_id TEXT,
    invoice_url TEXT,
    digitable_line TEXT,
    pix_code TEXT,
    payment_method TEXT,
    
    -- Metadata
    description TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    
    -- Constraint para evitar duplicatas
    CONSTRAINT unique_subscription_invoice_competence UNIQUE (clinic_id, competence_month, competence_year)
);

-- Índices
CREATE INDEX idx_subscription_invoices_clinic ON public.subscription_invoices(clinic_id);
CREATE INDEX idx_subscription_invoices_status ON public.subscription_invoices(status);
CREATE INDEX idx_subscription_invoices_due_date ON public.subscription_invoices(due_date);
CREATE INDEX idx_subscription_invoices_lytex ON public.subscription_invoices(lytex_invoice_id);
CREATE INDEX idx_subscription_invoices_competence ON public.subscription_invoices(competence_year, competence_month);

-- RLS
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

-- Política para super admins (usando tabela super_admins)
CREATE POLICY "Super admins can manage subscription invoices"
ON public.subscription_invoices
FOR ALL
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

-- Política para que clínicas vejam seus próprios boletos
CREATE POLICY "Clinics can view their own subscription invoices"
ON public.subscription_invoices
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND clinic_id = subscription_invoices.clinic_id
    )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_subscription_invoices_updated_at
    BEFORE UPDATE ON public.subscription_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para configuração da integração Lytex de assinaturas (global)
CREATE TABLE public.subscription_billing_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Configurações de geração automática
    auto_generate_enabled BOOLEAN DEFAULT false,
    generate_day_of_month INTEGER DEFAULT 1 CHECK (generate_day_of_month >= 1 AND generate_day_of_month <= 28),
    default_due_day_offset INTEGER DEFAULT 10,
    
    -- Integração Lytex (terceira conta - configurada via secrets)
    lytex_enabled BOOLEAN DEFAULT false,
    
    -- Notificações
    send_email_on_generation BOOLEAN DEFAULT true,
    send_whatsapp_on_generation BOOLEAN DEFAULT false,
    send_reminder_days_before INTEGER DEFAULT 3,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para configurações
ALTER TABLE public.subscription_billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admins can manage billing settings"
ON public.subscription_billing_settings
FOR ALL
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

-- Inserir registro padrão
INSERT INTO public.subscription_billing_settings (id) VALUES (gen_random_uuid());

-- Habilitar realtime para faturas
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_invoices;

COMMENT ON TABLE public.subscription_invoices IS 'Boletos de assinatura para clínicas pagarem seus planos';
COMMENT ON TABLE public.subscription_billing_settings IS 'Configurações globais de cobrança de assinaturas';