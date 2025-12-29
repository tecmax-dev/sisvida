-- ==========================================
-- WhatsApp Booking Sessions Table
-- Manages stateful conversations for booking via WhatsApp
-- ==========================================

CREATE TABLE public.whatsapp_booking_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'INIT',
  
  -- Patient info (filled during flow)
  patient_id UUID REFERENCES public.patients(id),
  patient_name TEXT,
  
  -- Selection data
  selected_professional_id UUID REFERENCES public.professionals(id),
  selected_professional_name TEXT,
  selected_date DATE,
  selected_time TIME,
  selected_procedure_id UUID REFERENCES public.procedures(id),
  
  -- Available options cache (JSON arrays for numbered lists)
  available_professionals JSONB,
  available_dates JSONB,
  available_times JSONB,
  
  -- Session management
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_whatsapp_booking_sessions_phone_clinic ON public.whatsapp_booking_sessions(phone, clinic_id);
CREATE INDEX idx_whatsapp_booking_sessions_expires ON public.whatsapp_booking_sessions(expires_at);
CREATE INDEX idx_whatsapp_booking_sessions_state ON public.whatsapp_booking_sessions(state);

-- Enable RLS
ALTER TABLE public.whatsapp_booking_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clinic admins can manage booking sessions"
ON public.whatsapp_booking_sessions
FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can view booking sessions"
ON public.whatsapp_booking_sessions
FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

-- Service role insert policy (for edge functions)
CREATE POLICY "Service can insert booking sessions"
ON public.whatsapp_booking_sessions
FOR INSERT
WITH CHECK (true);

-- Service role update policy (for edge functions)
CREATE POLICY "Service can update booking sessions"
ON public.whatsapp_booking_sessions
FOR UPDATE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_booking_sessions_updated_at
BEFORE UPDATE ON public.whatsapp_booking_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime for session updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_booking_sessions;

-- Add comments for documentation
COMMENT ON TABLE public.whatsapp_booking_sessions IS 'Manages stateful WhatsApp booking conversations';
COMMENT ON COLUMN public.whatsapp_booking_sessions.state IS 'Current conversation state: INIT, WAITING_CPF, CONFIRM_IDENTITY, SELECT_PROFESSIONAL, SELECT_DATE, SELECT_TIME, CONFIRM_APPOINTMENT, FINISHED, EXPIRED';