-- Create financial_categories table
CREATE TABLE public.financial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT financial_categories_type_check CHECK (type IN ('income', 'expense'))
);

-- Create financial_transactions table
CREATE TABLE public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    category_id UUID REFERENCES financial_categories(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT,
    status TEXT DEFAULT 'pending',
    due_date DATE,
    paid_date DATE,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT financial_transactions_type_check CHECK (type IN ('income', 'expense')),
    CONSTRAINT financial_transactions_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer', 'check', 'insurance')),
    CONSTRAINT financial_transactions_status_check CHECK (status IN ('pending', 'paid', 'cancelled', 'overdue'))
);

-- Create payment_plans table
CREATE TABLE public.payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    installments INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT payment_plans_status_check CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- Enable RLS on all tables
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial_categories (only clinic admins)
CREATE POLICY "Clinic admins can view financial categories"
ON public.financial_categories FOR SELECT
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage financial categories"
ON public.financial_categories FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for financial_transactions (only clinic admins)
CREATE POLICY "Clinic admins can view financial transactions"
ON public.financial_transactions FOR SELECT
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage financial transactions"
ON public.financial_transactions FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS Policies for payment_plans (only clinic admins)
CREATE POLICY "Clinic admins can view payment plans"
ON public.payment_plans FOR SELECT
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage payment plans"
ON public.payment_plans FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Create indexes for performance
CREATE INDEX idx_financial_categories_clinic ON financial_categories(clinic_id);
CREATE INDEX idx_financial_transactions_clinic ON financial_transactions(clinic_id);
CREATE INDEX idx_financial_transactions_date ON financial_transactions(due_date);
CREATE INDEX idx_financial_transactions_status ON financial_transactions(status);
CREATE INDEX idx_payment_plans_clinic ON payment_plans(clinic_id);

-- Add updated_at triggers
CREATE TRIGGER update_financial_categories_updated_at
    BEFORE UPDATE ON financial_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_transactions_updated_at
    BEFORE UPDATE ON financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_plans_updated_at
    BEFORE UPDATE ON payment_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();