-- Add unique constraint to whatsapp_ai_conversations
ALTER TABLE public.whatsapp_ai_conversations 
ADD CONSTRAINT whatsapp_ai_conversations_clinic_id_phone_key UNIQUE (clinic_id, phone);

-- Add unique constraint to whatsapp_booking_sessions
ALTER TABLE public.whatsapp_booking_sessions 
ADD CONSTRAINT whatsapp_booking_sessions_clinic_id_phone_key UNIQUE (clinic_id, phone);
