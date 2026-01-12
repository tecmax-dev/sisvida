-- Create union_chart_of_accounts table (mirror of chart_of_accounts for union module)
CREATE TABLE public.union_chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.union_chart_of_accounts(id),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  hierarchy_level INTEGER DEFAULT 1,
  full_path TEXT,
  is_synthetic BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(clinic_id, account_code)
);

-- Enable RLS
ALTER TABLE public.union_chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for union_chart_of_accounts
CREATE POLICY "Union admins can view chart of accounts"
  ON public.union_chart_of_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.clinic_id = union_chart_of_accounts.clinic_id
      AND ur.role IN ('owner', 'admin', 'entidade_sindical_admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  );

CREATE POLICY "Union admins can manage chart of accounts"
  ON public.union_chart_of_accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.clinic_id = union_chart_of_accounts.clinic_id
      AND ur.role IN ('owner', 'admin', 'entidade_sindical_admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.clinic_id = union_chart_of_accounts.clinic_id
      AND ur.role IN ('owner', 'admin', 'entidade_sindical_admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.super_admins sa
      WHERE sa.user_id = auth.uid()
    )
  );

-- Create index for performance
CREATE INDEX idx_union_chart_of_accounts_clinic ON public.union_chart_of_accounts(clinic_id);
CREATE INDEX idx_union_chart_of_accounts_parent ON public.union_chart_of_accounts(parent_id);
CREATE INDEX idx_union_chart_of_accounts_code ON public.union_chart_of_accounts(account_code);

-- Trigger for updated_at
CREATE TRIGGER update_union_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.union_chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();