-- Tabela de Caixas/Contas Bancárias
CREATE TABLE public.cash_registers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash', -- cash, bank, credit_card, other
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  bank_name TEXT,
  agency TEXT,
  account_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Transferências entre Caixas
CREATE TABLE public.cash_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  from_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  to_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Transações Recorrentes
CREATE TABLE public.recurring_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- income, expense
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly', -- daily, weekly, monthly, yearly
  start_date DATE NOT NULL,
  end_date DATE,
  next_due_date DATE NOT NULL,
  day_of_month INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Comissões de Profissionais
CREATE TABLE public.professional_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  percentage NUMERIC,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  due_date DATE,
  paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar campo de caixa nas transações financeiras
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL;

-- Adicionar campo de reconciliação nas transações
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bank_reference TEXT;

-- Enable RLS
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cash_registers
CREATE POLICY "Clinic admins can manage cash registers" 
ON public.cash_registers FOR ALL 
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can view cash registers" 
ON public.cash_registers FOR SELECT 
USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS Policies for cash_transfers
CREATE POLICY "Clinic admins can manage cash transfers" 
ON public.cash_transfers FOR ALL 
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can view cash transfers" 
ON public.cash_transfers FOR SELECT 
USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS Policies for recurring_transactions
CREATE POLICY "Clinic admins can manage recurring transactions" 
ON public.recurring_transactions FOR ALL 
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can view recurring transactions" 
ON public.recurring_transactions FOR SELECT 
USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS Policies for professional_commissions
CREATE POLICY "Clinic admins can manage commissions" 
ON public.professional_commissions FOR ALL 
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can view commissions" 
ON public.professional_commissions FOR SELECT 
USING (has_clinic_access(auth.uid(), clinic_id));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_cash_registers_updated_at
BEFORE UPDATE ON public.cash_registers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_transactions_updated_at
BEFORE UPDATE ON public.recurring_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_professional_commissions_updated_at
BEFORE UPDATE ON public.professional_commissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();