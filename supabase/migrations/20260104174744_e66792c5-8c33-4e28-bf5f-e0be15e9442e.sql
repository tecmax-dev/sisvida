-- Tabela de escritórios de contabilidade
CREATE TABLE public.accounting_offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  contact_name TEXT,
  access_code TEXT,
  access_code_expires_at TIMESTAMP WITH TIME ZONE,
  portal_last_access_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice único para email por clínica
CREATE UNIQUE INDEX accounting_offices_email_clinic_idx ON public.accounting_offices(email, clinic_id);

-- Tabela de vínculo entre escritórios e empresas
CREATE TABLE public.accounting_office_employers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accounting_office_id UUID NOT NULL REFERENCES public.accounting_offices(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(accounting_office_id, employer_id)
);

-- Tabela de logs de acesso ao portal
CREATE TABLE public.accounting_office_portal_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accounting_office_id UUID NOT NULL REFERENCES public.accounting_offices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounting_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_office_employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_office_portal_logs ENABLE ROW LEVEL SECURITY;

-- Policies para accounting_offices
CREATE POLICY "Users can view accounting offices from their clinic"
  ON public.accounting_offices FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert accounting offices in their clinic"
  ON public.accounting_offices FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update accounting offices from their clinic"
  ON public.accounting_offices FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete accounting offices from their clinic"
  ON public.accounting_offices FOR DELETE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- Policies para accounting_office_employers
CREATE POLICY "Users can view accounting office employers from their clinic"
  ON public.accounting_office_employers FOR SELECT
  USING (
    accounting_office_id IN (
      SELECT id FROM public.accounting_offices WHERE clinic_id IN (
        SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert accounting office employers"
  ON public.accounting_office_employers FOR INSERT
  WITH CHECK (
    accounting_office_id IN (
      SELECT id FROM public.accounting_offices WHERE clinic_id IN (
        SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete accounting office employers"
  ON public.accounting_office_employers FOR DELETE
  USING (
    accounting_office_id IN (
      SELECT id FROM public.accounting_offices WHERE clinic_id IN (
        SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

-- Policies para logs (apenas insert público para o portal)
CREATE POLICY "Anyone can insert portal logs"
  ON public.accounting_office_portal_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view portal logs from their clinic"
  ON public.accounting_office_portal_logs FOR SELECT
  USING (
    accounting_office_id IN (
      SELECT id FROM public.accounting_offices WHERE clinic_id IN (
        SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_accounting_offices_updated_at
  BEFORE UPDATE ON public.accounting_offices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();