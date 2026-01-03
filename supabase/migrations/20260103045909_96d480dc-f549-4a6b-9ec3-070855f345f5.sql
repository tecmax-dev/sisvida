-- Add protocol column
ALTER TABLE public.whatsapp_tickets ADD COLUMN IF NOT EXISTS protocol text;

-- Add is_bot_active column
ALTER TABLE public.whatsapp_tickets ADD COLUMN IF NOT EXISTS is_bot_active boolean DEFAULT true;

-- Add first_response_at column
ALTER TABLE public.whatsapp_tickets ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

-- Add unread_count column
ALTER TABLE public.whatsapp_tickets ADD COLUMN IF NOT EXISTS unread_count integer DEFAULT 0;

-- Add last_message column
ALTER TABLE public.whatsapp_tickets ADD COLUMN IF NOT EXISTS last_message text;

-- Add assigned_operator_id column (referencing operators)
ALTER TABLE public.whatsapp_tickets ADD COLUMN IF NOT EXISTS assigned_operator_id uuid REFERENCES public.whatsapp_operators(id);

-- Copy data from operator_id to assigned_operator_id
UPDATE public.whatsapp_tickets 
SET assigned_operator_id = operator_id 
WHERE assigned_operator_id IS NULL AND operator_id IS NOT NULL;

-- Create function to generate protocol
CREATE OR REPLACE FUNCTION public.generate_whatsapp_ticket_protocol()
RETURNS trigger AS $$
DECLARE
  next_seq integer;
BEGIN
  IF NEW.protocol IS NULL THEN
    SELECT COUNT(*) + 1 INTO next_seq
    FROM public.whatsapp_tickets
    WHERE clinic_id = NEW.clinic_id
    AND DATE(created_at) = DATE(COALESCE(NEW.created_at, now()));
    
    NEW.protocol := 'T' || to_char(COALESCE(NEW.created_at, now()), 'YYYYMMDD') || LPAD(next_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generate_whatsapp_ticket_protocol ON public.whatsapp_tickets;
CREATE TRIGGER trigger_generate_whatsapp_ticket_protocol
  BEFORE INSERT ON public.whatsapp_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_whatsapp_ticket_protocol();