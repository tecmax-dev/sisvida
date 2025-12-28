-- Add columns for floating badges customization
ALTER TABLE public.hero_settings 
ADD COLUMN IF NOT EXISTS badge_1_text TEXT DEFAULT 'Online 24h',
ADD COLUMN IF NOT EXISTS badge_2_text TEXT DEFAULT '100% Seguro';