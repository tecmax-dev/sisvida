-- Tabela para solicitações de aprovação de dependentes
CREATE TABLE public.pending_dependent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  dependent_id UUID NOT NULL REFERENCES public.patient_dependents(id) ON DELETE CASCADE,
  requester_phone TEXT NOT NULL,
  cpf_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_pending_approvals_clinic ON public.pending_dependent_approvals(clinic_id);
CREATE INDEX idx_pending_approvals_status ON public.pending_dependent_approvals(status);
CREATE INDEX idx_pending_approvals_created ON public.pending_dependent_approvals(created_at DESC);

-- Coluna para marcar dependentes aguardando aprovação
ALTER TABLE public.patient_dependents 
ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN DEFAULT false;

-- RLS para pending_dependent_approvals
ALTER TABLE public.pending_dependent_approvals ENABLE ROW LEVEL SECURITY;

-- Super admins podem ver todas as aprovações
CREATE POLICY "Super admins can manage all approvals"
ON public.pending_dependent_approvals
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Staff da clínica pode visualizar aprovações da sua clínica
CREATE POLICY "Clinic staff can view approvals"
ON public.pending_dependent_approvals
FOR SELECT
USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Admins da clínica podem gerenciar aprovações
CREATE POLICY "Clinic admins can manage approvals"
ON public.pending_dependent_approvals
FOR ALL
USING (public.is_clinic_admin(auth.uid(), clinic_id));

-- Bucket para fotos de CPF de dependentes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dependent-cpf-photos',
  'dependent-cpf-photos',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket
CREATE POLICY "Clinic admins can view cpf photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'dependent-cpf-photos' AND
  (
    public.is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.pending_dependent_approvals pda
      WHERE pda.cpf_photo_url LIKE '%' || name
      AND public.is_clinic_admin(auth.uid(), pda.clinic_id)
    )
  )
);

CREATE POLICY "System can upload cpf photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'dependent-cpf-photos');

CREATE POLICY "Clinic admins can delete cpf photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'dependent-cpf-photos' AND
  (
    public.is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.pending_dependent_approvals pda
      WHERE pda.cpf_photo_url LIKE '%' || name
      AND public.is_clinic_admin(auth.uid(), pda.clinic_id)
    )
  )
);

-- Habilitar realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_dependent_approvals;