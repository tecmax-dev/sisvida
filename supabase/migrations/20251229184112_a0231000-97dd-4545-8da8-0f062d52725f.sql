-- Create patient_cards table for digital patient cards
CREATE TABLE public.patient_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  qr_code_token UUID NOT NULL DEFAULT gen_random_uuid(),
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, card_number),
  UNIQUE(qr_code_token)
);

-- Enable RLS
ALTER TABLE public.patient_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view cards by QR token"
ON public.patient_cards
FOR SELECT
USING (qr_code_token IS NOT NULL);

CREATE POLICY "Clinic members can view patient cards"
ON public.patient_cards
FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can insert patient cards"
ON public.patient_cards
FOR INSERT
WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can update patient cards"
ON public.patient_cards
FOR UPDATE
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can delete patient cards"
ON public.patient_cards
FOR DELETE
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_patient_cards_updated_at
BEFORE UPDATE ON public.patient_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for faster queries
CREATE INDEX idx_patient_cards_clinic ON public.patient_cards(clinic_id);
CREATE INDEX idx_patient_cards_patient ON public.patient_cards(patient_id);
CREATE INDEX idx_patient_cards_expires ON public.patient_cards(expires_at);
CREATE INDEX idx_patient_cards_qr_token ON public.patient_cards(qr_code_token);

-- Function to generate unique card number
CREATE OR REPLACE FUNCTION public.generate_card_number(p_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_year text;
  next_number integer;
  result text;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(card_number FROM 6) AS integer)), 0) + 1
  INTO next_number
  FROM patient_cards
  WHERE clinic_id = p_clinic_id
  AND card_number LIKE 'C' || current_year || '%';
  
  result := 'C' || current_year || LPAD(next_number::text, 5, '0');
  RETURN result;
END;
$$;

-- Function to check if patient card is valid for appointments
CREATE OR REPLACE FUNCTION public.is_patient_card_valid(p_patient_id uuid, p_clinic_id uuid)
RETURNS TABLE(is_valid boolean, card_number text, expires_at timestamp with time zone, days_until_expiry integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card RECORD;
BEGIN
  SELECT pc.card_number, pc.expires_at, pc.is_active
  INTO v_card
  FROM patient_cards pc
  WHERE pc.patient_id = p_patient_id
  AND pc.clinic_id = p_clinic_id
  AND pc.is_active = true
  ORDER BY pc.expires_at DESC
  LIMIT 1;
  
  IF v_card IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, NULL::INTEGER;
    RETURN;
  END IF;
  
  IF v_card.expires_at < now() THEN
    RETURN QUERY SELECT false, v_card.card_number, v_card.expires_at, 
      EXTRACT(DAY FROM (v_card.expires_at - now()))::INTEGER;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_card.card_number, v_card.expires_at,
    EXTRACT(DAY FROM (v_card.expires_at - now()))::INTEGER;
END;
$$;

-- Trigger function to validate card before appointment
CREATE OR REPLACE FUNCTION public.validate_patient_card_for_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card_valid RECORD;
  v_require_card BOOLEAN;
BEGIN
  -- Skip validation for cancellations and completed appointments
  IF NEW.status IN ('cancelled', 'completed', 'no_show') THEN
    RETURN NEW;
  END IF;
  
  -- Check if clinic requires valid card (future: add setting to clinics table)
  -- For now, check if patient has ANY card issued - if they do, it must be valid
  SELECT * INTO v_card_valid FROM is_patient_card_valid(NEW.patient_id, NEW.clinic_id);
  
  -- If patient has a card but it's expired, block appointment
  IF v_card_valid.card_number IS NOT NULL AND v_card_valid.is_valid = false THEN
    RAISE EXCEPTION 'CARTEIRINHA_VENCIDA: A carteirinha do paciente (%) expirou em %. Por favor, renove a carteirinha para agendar.', 
      v_card_valid.card_number, 
      to_char(v_card_valid.expires_at, 'DD/MM/YYYY');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for appointment validation
CREATE TRIGGER validate_patient_card_before_appointment
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.validate_patient_card_for_appointment();

-- Table for card expiry notification logs
CREATE TABLE public.card_expiry_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.patient_cards(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'expiring_soon', 'expired'
  days_before_expiry INTEGER,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.card_expiry_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification logs
CREATE POLICY "Clinic members can view card notifications"
ON public.card_expiry_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_cards pc
    WHERE pc.id = card_expiry_notifications.card_id
    AND has_clinic_access(auth.uid(), pc.clinic_id)
  )
);

CREATE POLICY "System can insert card notifications"
ON public.card_expiry_notifications
FOR INSERT
WITH CHECK (true);

-- Index for notification logs
CREATE INDEX idx_card_expiry_notifications_card ON public.card_expiry_notifications(card_id);
CREATE INDEX idx_card_expiry_notifications_sent ON public.card_expiry_notifications(sent_at);

-- Enable realtime for patient_cards
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_cards;