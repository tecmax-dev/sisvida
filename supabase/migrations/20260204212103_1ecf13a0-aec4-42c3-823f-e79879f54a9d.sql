-- Add column to support navigating to authorizations tab
ALTER TABLE public.popup_notices 
ADD COLUMN IF NOT EXISTS navigate_to_authorizations BOOLEAN DEFAULT false;