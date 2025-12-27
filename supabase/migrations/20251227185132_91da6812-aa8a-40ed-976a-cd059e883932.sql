-- Add password_changed column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT FALSE;

-- Update existing users to have password_changed = true (assuming they already have their own passwords)
UPDATE public.profiles 
SET password_changed = true 
WHERE password_changed IS NULL;