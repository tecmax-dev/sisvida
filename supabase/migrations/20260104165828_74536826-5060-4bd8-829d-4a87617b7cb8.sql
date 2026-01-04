-- Adicionar código de acesso para empresas no portal
ALTER TABLE public.employers 
ADD COLUMN IF NOT EXISTS access_code TEXT,
ADD COLUMN IF NOT EXISTS access_code_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS portal_last_access_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para busca rápida por CNPJ + código
CREATE INDEX IF NOT EXISTS idx_employers_cnpj_access ON public.employers (cnpj, access_code);

-- Função para gerar código de acesso aleatório
CREATE OR REPLACE FUNCTION public.generate_employer_access_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Tabela para log de acessos ao portal
CREATE TABLE IF NOT EXISTS public.employer_portal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.employer_portal_logs ENABLE ROW LEVEL SECURITY;

-- Permitir inserção pública (via edge function)
CREATE POLICY "Allow public insert on employer_portal_logs"
ON public.employer_portal_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Permitir leitura para admins da clínica
CREATE POLICY "Clinic admins can view portal logs"
ON public.employer_portal_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employers e
    JOIN public.user_roles ur ON ur.clinic_id = e.clinic_id
    WHERE e.id = employer_portal_logs.employer_id
    AND ur.user_id = auth.uid()
  )
);

-- Tabela para solicitações de 2ª via
CREATE TABLE IF NOT EXISTS public.contribution_reissue_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID REFERENCES public.employer_contributions(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES public.employers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason TEXT,
  admin_notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  new_due_date DATE,
  new_lytex_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.contribution_reissue_requests ENABLE ROW LEVEL SECURITY;

-- Permitir inserção pública (via edge function)
CREATE POLICY "Allow public insert on reissue_requests"
ON public.contribution_reissue_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Permitir leitura para admins da clínica
CREATE POLICY "Clinic admins can view reissue_requests"
ON public.contribution_reissue_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employers e
    JOIN public.user_roles ur ON ur.clinic_id = e.clinic_id
    WHERE e.id = contribution_reissue_requests.employer_id
    AND ur.user_id = auth.uid()
  )
);

-- Permitir update para admins da clínica
CREATE POLICY "Clinic admins can update reissue_requests"
ON public.contribution_reissue_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employers e
    JOIN public.user_roles ur ON ur.clinic_id = e.clinic_id
    WHERE e.id = contribution_reissue_requests.employer_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);