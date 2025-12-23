-- Create patient_folders table for hierarchical organization
CREATE TABLE public.patient_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES public.patient_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create patient_attachments table for files
CREATE TABLE public.patient_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.patient_folders(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  description TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attachment_access_logs table for audit trail
CREATE TABLE public.attachment_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES public.patient_attachments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_patient_folders_clinic_patient ON public.patient_folders(clinic_id, patient_id);
CREATE INDEX idx_patient_folders_parent ON public.patient_folders(parent_folder_id);
CREATE INDEX idx_patient_attachments_clinic_patient ON public.patient_attachments(clinic_id, patient_id);
CREATE INDEX idx_patient_attachments_folder ON public.patient_attachments(folder_id);
CREATE INDEX idx_attachment_access_logs_attachment ON public.attachment_access_logs(attachment_id);
CREATE INDEX idx_attachment_access_logs_user ON public.attachment_access_logs(user_id);

-- Enable RLS on all tables
ALTER TABLE public.patient_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for patient_folders
CREATE POLICY "Users can view folders of their clinics"
ON public.patient_folders FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage folders of their clinics"
ON public.patient_folders FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS policies for patient_attachments
CREATE POLICY "Users can view attachments of their clinics"
ON public.patient_attachments FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage attachments of their clinics"
ON public.patient_attachments FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS policies for attachment_access_logs
CREATE POLICY "Users can view access logs of their clinic attachments"
ON public.attachment_access_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.patient_attachments pa
  WHERE pa.id = attachment_access_logs.attachment_id
  AND has_clinic_access(auth.uid(), pa.clinic_id)
));

CREATE POLICY "Users can insert their own access logs"
ON public.attachment_access_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for patient attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-attachments', 'patient-attachments', false);

-- Storage policies for patient-attachments bucket
CREATE POLICY "Users can view patient attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'patient-attachments' AND
  EXISTS (
    SELECT 1 FROM public.patient_attachments pa
    WHERE pa.file_path = name
    AND has_clinic_access(auth.uid(), pa.clinic_id)
  )
);

CREATE POLICY "Users can upload patient attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'patient-attachments' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.clinic_id::text = (string_to_array(name, '/'))[1]
  )
);

CREATE POLICY "Users can delete patient attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'patient-attachments' AND
  EXISTS (
    SELECT 1 FROM public.patient_attachments pa
    WHERE pa.file_path = name
    AND has_clinic_access(auth.uid(), pa.clinic_id)
  )
);

-- Trigger for updated_at on patient_folders
CREATE TRIGGER update_patient_folders_updated_at
BEFORE UPDATE ON public.patient_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on patient_attachments
CREATE TRIGGER update_patient_attachments_updated_at
BEFORE UPDATE ON public.patient_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();