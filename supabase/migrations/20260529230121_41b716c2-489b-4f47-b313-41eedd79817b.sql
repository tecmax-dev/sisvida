CREATE TABLE IF NOT EXISTS public.appointment_slot_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_slot_blocks_lookup
  ON public.appointment_slot_blocks (clinic_id, professional_id, block_date, start_time);

GRANT SELECT ON public.appointment_slot_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_slot_blocks TO authenticated;
GRANT ALL ON public.appointment_slot_blocks TO service_role;

ALTER TABLE public.appointment_slot_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view appointment slot blocks"
  ON public.appointment_slot_blocks
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Clinic members can insert slot blocks"
  ON public.appointment_slot_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update slot blocks"
  ON public.appointment_slot_blocks
  FOR UPDATE
  TO authenticated
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can delete slot blocks"
  ON public.appointment_slot_blocks
  FOR DELETE
  TO authenticated
  USING (public.has_clinic_access(auth.uid(), clinic_id));