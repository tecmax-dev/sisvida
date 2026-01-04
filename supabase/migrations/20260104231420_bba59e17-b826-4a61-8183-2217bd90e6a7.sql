-- Create members (sócios) table
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  cpf VARCHAR(14) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  cep VARCHAR(10),
  neighborhood VARCHAR(100),
  birth_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  access_code VARCHAR(10),
  access_code_expires_at TIMESTAMPTZ,
  portal_last_access_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, cpf)
);

-- Create member categories table
CREATE TABLE public.member_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add category_id to members
ALTER TABLE public.members ADD COLUMN category_id UUID REFERENCES public.member_categories(id);

-- Create member contributions table
CREATE TABLE public.member_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  contribution_type_id UUID NOT NULL REFERENCES public.contribution_types(id),
  competence_month INTEGER NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
  competence_year INTEGER NOT NULL CHECK (competence_year BETWEEN 2000 AND 2100),
  due_date DATE NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'awaiting_value')),
  paid_at TIMESTAMPTZ,
  paid_value NUMERIC(12,2),
  payment_method VARCHAR(50),
  notes TEXT,
  lytex_invoice_id VARCHAR(100),
  lytex_invoice_url TEXT,
  lytex_pix_code TEXT,
  lytex_pix_qrcode TEXT,
  lytex_boleto_barcode VARCHAR(100),
  lytex_boleto_digitable_line VARCHAR(100),
  portal_reissue_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create member portal logs table
CREATE TABLE public.member_portal_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_portal_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members
CREATE POLICY "Users can view members from their clinic" ON public.members
  FOR SELECT USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert members in their clinic" ON public.members
  FOR INSERT WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update members in their clinic" ON public.members
  FOR UPDATE USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete members from their clinic" ON public.members
  FOR DELETE USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Public access for portal (by access code validation done in edge function)
CREATE POLICY "Allow public select for portal access" ON public.members
  FOR SELECT USING (true);

-- RLS Policies for member_categories
CREATE POLICY "Users can view member_categories from their clinic" ON public.member_categories
  FOR SELECT USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert member_categories in their clinic" ON public.member_categories
  FOR INSERT WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update member_categories in their clinic" ON public.member_categories
  FOR UPDATE USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete member_categories from their clinic" ON public.member_categories
  FOR DELETE USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for member_contributions
CREATE POLICY "Users can view member_contributions from their clinic" ON public.member_contributions
  FOR SELECT USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert member_contributions in their clinic" ON public.member_contributions
  FOR INSERT WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update member_contributions in their clinic" ON public.member_contributions
  FOR UPDATE USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete member_contributions from their clinic" ON public.member_contributions
  FOR DELETE USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Public access for portal
CREATE POLICY "Allow public select for member contributions portal" ON public.member_contributions
  FOR SELECT USING (true);

-- RLS for logs (public insert for portal)
CREATE POLICY "Anyone can insert member portal logs" ON public.member_portal_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view portal logs from their members" ON public.member_portal_logs
  FOR SELECT USING (member_id IN (SELECT id FROM public.members WHERE clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid())));

-- Indexes for performance
CREATE INDEX idx_members_clinic_id ON public.members(clinic_id);
CREATE INDEX idx_members_cpf ON public.members(cpf);
CREATE INDEX idx_members_category_id ON public.members(category_id);
CREATE INDEX idx_member_contributions_clinic_id ON public.member_contributions(clinic_id);
CREATE INDEX idx_member_contributions_member_id ON public.member_contributions(member_id);
CREATE INDEX idx_member_contributions_status ON public.member_contributions(status);
CREATE INDEX idx_member_contributions_due_date ON public.member_contributions(due_date);

-- Trigger for updated_at
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_categories_updated_at
  BEFORE UPDATE ON public.member_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_contributions_updated_at
  BEFORE UPDATE ON public.member_contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();