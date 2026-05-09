-- Clean up duplicates by keeping only the most recent one
DELETE FROM public.whatsapp_boleto_sessions a
USING public.whatsapp_boleto_sessions b
WHERE a.id < b.id
  AND a.clinic_id = b.clinic_id
  AND a.phone = b.phone;

ALTER TABLE public.whatsapp_boleto_sessions ADD CONSTRAINT whatsapp_boleto_sessions_clinic_phone_unique UNIQUE (clinic_id, phone);