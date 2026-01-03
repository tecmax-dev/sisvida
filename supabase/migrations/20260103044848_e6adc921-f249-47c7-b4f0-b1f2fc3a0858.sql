-- Add order_index column to whatsapp_sectors table
ALTER TABLE public.whatsapp_sectors 
ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;