-- Add use_ai_booking flag to clinics table
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS use_ai_booking boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.clinics.use_ai_booking IS 'Enable AI-powered WhatsApp booking flow instead of menu-based';

-- Create table to store AI conversation history per phone/clinic
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 minutes')
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_conversations_phone_clinic 
ON public.whatsapp_ai_conversations(phone, clinic_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_conversations_expires 
ON public.whatsapp_ai_conversations(expires_at);

-- Enable RLS
ALTER TABLE public.whatsapp_ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role only - this is managed by edge functions)
CREATE POLICY "Service role full access to ai conversations" 
ON public.whatsapp_ai_conversations 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_ai_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();