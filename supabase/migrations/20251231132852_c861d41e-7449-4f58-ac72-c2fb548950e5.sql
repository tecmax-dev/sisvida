-- Create table to track payslip requests
CREATE TABLE public.payslip_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.patient_cards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  received_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  attachment_path TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payslip_requests ENABLE ROW LEVEL SECURITY;

-- Policies for payslip_requests
CREATE POLICY "Clinic admins can manage payslip requests"
  ON public.payslip_requests
  FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can view payslip requests"
  ON public.payslip_requests
  FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "System can insert payslip requests"
  ON public.payslip_requests
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update payslip requests"
  ON public.payslip_requests
  FOR UPDATE
  USING (true);

-- Create storage bucket for payslips (contra cheques)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contra-cheques',
  'contra-cheques',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Storage policies - Only clinic admins can access
CREATE POLICY "Clinic admins can view payslips"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'contra-cheques'
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id::text = (storage.foldername(name))[1]
        AND is_clinic_admin(auth.uid(), c.id)
      )
    )
  );

CREATE POLICY "Clinic admins can upload payslips"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'contra-cheques'
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id::text = (storage.foldername(name))[1]
        AND is_clinic_admin(auth.uid(), c.id)
      )
    )
  );

CREATE POLICY "Clinic admins can delete payslips"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'contra-cheques'
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id::text = (storage.foldername(name))[1]
        AND is_clinic_admin(auth.uid(), c.id)
      )
    )
  );

-- System policy for webhook uploads (service role)
CREATE POLICY "System can upload payslips"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'contra-cheques');

-- Add index for performance
CREATE INDEX idx_payslip_requests_clinic_status ON public.payslip_requests(clinic_id, status);
CREATE INDEX idx_payslip_requests_patient ON public.payslip_requests(patient_id);
CREATE INDEX idx_payslip_requests_card ON public.payslip_requests(card_id);