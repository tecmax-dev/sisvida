-- Create import_logs table for tracking import history
CREATE TABLE public.import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL, -- 'patients', 'records', 'contacts', 'combined'
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed', 'cancelled'
  error_details JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can see all import logs
CREATE POLICY "Super admins can view all import logs"
ON public.import_logs
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can insert import logs
CREATE POLICY "Super admins can insert import logs"
ON public.import_logs
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Super admins can update import logs
CREATE POLICY "Super admins can update import logs"
ON public.import_logs
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Super admins can delete import logs
CREATE POLICY "Super admins can delete import logs"
ON public.import_logs
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_import_logs_clinic_id ON public.import_logs(clinic_id);
CREATE INDEX idx_import_logs_created_at ON public.import_logs(created_at DESC);